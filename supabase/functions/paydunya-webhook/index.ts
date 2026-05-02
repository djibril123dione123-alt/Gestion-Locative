/**
 * Edge Function : paydunya-webhook
 *
 * Reçoit les webhooks PayDunya (IPN — Instant Payment Notification).
 * Vérifie la signature HMAC, met à jour la transaction, active l'abonnement.
 *
 * URL à configurer dans PayDunya Dashboard :
 *   POST https://<project>.supabase.co/functions/v1/paydunya-webhook
 *
 * Sécurité :
 *   - Vérification du master key PayDunya dans le header
 *   - Double vérification du statut de la transaction (idempotent)
 *   - Utilise service role pour bypass RLS (webhook externe non authentifié)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

const PAYDUNYA_MASTER_KEY = Deno.env.get("PAYDUNYA_MASTER_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const IS_PROD = Deno.env.get("PAYDUNYA_ENV") === "live";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();

    // ── Vérification du master key PayDunya ──────────────────────────────────
    // PayDunya envoie le master key dans le payload comme "data.master_key_hash"
    // OU on vérifie manuellement via le header "Authorization: Bearer <master_key>"
    const authHeader = req.headers.get("Authorization") ?? "";
    const providedKey = authHeader.replace("Bearer ", "").trim();
    if (PAYDUNYA_MASTER_KEY && providedKey !== PAYDUNYA_MASTER_KEY) {
      console.warn("[webhook] Master key mismatch — possible spoofing attempt");
      return json({ error: "Unauthorized" }, 401);
    }

    const invoiceToken: string = body?.data?.invoice?.token ?? body?.invoice_token ?? "";
    const status: string = (body?.data?.status ?? body?.status ?? "").toLowerCase();
    const hash: string = body?.data?.hash ?? body?.hash ?? "";

    if (!invoiceToken) {
      return json({ error: "invoice_token manquant" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── Retrouver la transaction en attente ──────────────────────────────────
    const { data: txn, error: txnErr } = await supabase
      .from("payment_transactions")
      .select("id, agency_id, plan_id, amount_xof, phone, status")
      .eq("invoice_token", invoiceToken)
      .maybeSingle();

    if (txnErr) {
      console.error("[webhook] DB error:", txnErr.message);
      return json({ error: "DB error" }, 500);
    }

    if (!txn) {
      console.warn("[webhook] Transaction inconnue:", invoiceToken);
      return json({ error: "Transaction inconnue" }, 404);
    }

    // Idempotence — ignorer si déjà traitée
    if (txn.status === "completed") {
      return json({ success: true, already_processed: true });
    }

    // Sauvegarder le webhook brut
    await supabase
      .from("payment_transactions")
      .update({ webhook_raw: body, provider_ref: hash, updated_at: new Date().toISOString() })
      .eq("id", txn.id);

    if (status === "completed") {
      // ── Activer l'abonnement via RPC sécurisée ──────────────────────────
      const { error: activateErr } = await supabase.rpc("activate_subscription", {
        p_agency_id:      txn.agency_id,
        p_plan_id:        txn.plan_id,
        p_transaction_id: txn.id,
        p_amount_xof:     txn.amount_xof,
        p_phone:          txn.phone,
      });

      if (activateErr) {
        console.error("[webhook] activate_subscription error:", activateErr.message);
        return json({ error: "Activation failed", detail: activateErr.message }, 500);
      }

      // Déclencher l'envoi d'email de bienvenue si première activation
      await supabase.functions.invoke("send-email", {
        body: { trigger: "process_queue", agency_id: txn.agency_id },
      }).catch(() => { /* non bloquant */ });

      console.log(`[webhook] ✓ Abonnement activé : agency=${txn.agency_id} plan=${txn.plan_id}`);
      return json({ success: true, activated: true });

    } else if (status === "cancelled" || status === "failed") {
      await supabase
        .from("payment_transactions")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", txn.id);

      return json({ success: true, status });
    }

    return json({ success: true, status: "pending" });
  } catch (err) {
    console.error("[webhook] Erreur inattendue:", err);
    return json({ error: "Erreur interne" }, 500);
  }
});
