/**
 * Edge Function : senepay-webhook
 *
 * SenePay webhook handler. Modèle de sécurité :
 * - HMAC-SHA256 calculé sur le corps BRUT de la requête (jamais une
 *   reserialisation JSON), avec SENEPAY_WEBHOOK_SECRET, comparé en temps
 *   constant à l'en-tête X-SenePay-Signature ;
 * - la transaction est retrouvée par orderReference, qui est l'id interne
 *   payment_transactions.id que NOUS avons choisi à la création de la
 *   session (jamais une valeur que SenePay invente et qu'il faudrait faire
 *   confiance en aveugle) ;
 * - le sessionToken renvoyé doit correspondre à celui stocké en base ;
 * - montant revérifié avant toute activation ;
 * - activation déléguée à activate_subscription, qui verrouille la ligne
 *   (FOR UPDATE) : deux webhooks identiques ou concurrents ne peuvent jamais
 *   activer deux fois.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-senepay-signature, x-senepay-event",
  "Content-Type": "application/json",
};

const SENEPAY_WEBHOOK_SECRET = Deno.env.get("SENEPAY_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sigBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface SenePayWebhookPayload {
  event?: string;
  sessionToken?: string;
  orderReference?: string;
  status?: string;
  amount?: number;
  currency?: string;
  transactionId?: string;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!SENEPAY_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error("[senepay-webhook] missing server configuration");
      return json({ error: "Webhook not configured" }, 500);
    }

    // Le HMAC porte sur le corps BRUT — jamais sur une reserialisation JSON,
    // qui pourrait réordonner les clés et invalider silencieusement toutes
    // les signatures.
    const rawBody = await req.text();
    const signature = (req.headers.get("x-senepay-signature") ?? "").trim().toLowerCase();

    if (!signature) {
      console.warn("[senepay-webhook] signature manquante");
      return json({ error: "Signature manquante" }, 401);
    }

    const expectedSignature = await hmacSha256Hex(SENEPAY_WEBHOOK_SECRET, rawBody);
    if (!timingSafeEqualHex(signature, expectedSignature)) {
      console.warn("[senepay-webhook] signature invalide");
      return json({ error: "Unauthorized" }, 401);
    }

    let payload: SenePayWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json({ error: "JSON invalide" }, 400);
    }

    const orderReference = String(payload.orderReference ?? "");
    const status = String(payload.status ?? "").toLowerCase();
    const sessionToken = String(payload.sessionToken ?? "");
    const paidAmount = Number(payload.amount ?? 0);

    if (!orderReference) return json({ error: "orderReference manquant" }, 400);
    if (!status) return json({ error: "status manquant" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: txn, error: txnErr } = await supabase
      .from("payment_transactions")
      .select("id, agency_id, plan_id, amount_xof, status, is_founder_cycle, invoice_token")
      .eq("id", orderReference)
      .eq("provider", "senepay")
      .maybeSingle();

    if (txnErr) {
      console.error("[senepay-webhook] transaction lookup failed", txnErr.message);
      return json({ error: "DB error" }, 500);
    }
    if (!txn) return json({ error: "Transaction inconnue" }, 404);

    if (sessionToken && txn.invoice_token && sessionToken !== txn.invoice_token) {
      console.error("[senepay-webhook] session token mismatch", { orderReference, sessionToken });
      return json({ error: "Session mismatch" }, 422);
    }

    await supabase
      .from("payment_transactions")
      .update({ webhook_raw: payload, updated_at: new Date().toISOString() })
      .eq("id", txn.id);

    if (txn.status === "completed") {
      return json({ success: true, already_processed: true });
    }

    if (status === "complete" && paidAmount !== Number(txn.amount_xof)) {
      console.warn("[senepay-webhook] amount mismatch", { orderReference, paidAmount, expected: txn.amount_xof });
      return json({ error: "Amount mismatch" }, 422);
    }

    if (status === "complete") {
      const { error: activateErr } = await supabase.rpc("activate_subscription", {
        p_agency_id: txn.agency_id,
        p_plan_id: txn.plan_id,
        p_transaction_id: txn.id,
        p_amount_xof: txn.amount_xof,
        p_phone: null,
        p_is_founder_cycle: txn.is_founder_cycle ?? false,
      });

      if (activateErr) {
        console.error("[senepay-webhook] activate_subscription failed", activateErr.message);
        return json({ error: "Activation failed", detail: activateErr.message }, 500);
      }

      await supabase.functions.invoke("send-email", {
        body: { trigger: "process_queue", agency_id: txn.agency_id },
      }).catch(() => {});

      return json({ success: true, activated: true });
    }

    if (status === "failed" || status === "expired") {
      if (txn.status === "pending") {
        await supabase
          .from("payment_transactions")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", txn.id);
      }
      return json({ success: true, status: "failed" });
    }

    if (status === "cancelled" || status === "canceled") {
      if (txn.status === "pending") {
        await supabase
          .from("payment_transactions")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", txn.id);
      }
      return json({ success: true, status: "cancelled" });
    }

    // "open" / "processing" : rien à faire, on attend le prochain webhook.
    return json({ success: true, status: "pending" });
  } catch (err) {
    console.error("[senepay-webhook] unexpected error", err);
    return json({ error: "Erreur interne" }, 500);
  }
});
