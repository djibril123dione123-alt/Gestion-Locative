/**
 * Edge Function: paydunya-webhook
 *
 * PayDunya IPN handler. Security model:
 * - accepts JSON and application/x-www-form-urlencoded payloads;
 * - verifies data.hash === sha512(PAYDUNYA_MASTER_KEY);
 * - checks invoice token, amount and pending transaction;
 * - delegates activation to activate_subscription, which locks the row.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const PAYDUNYA_MASTER_KEY = Deno.env.get("PAYDUNYA_MASTER_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

async function sha512Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function assignNested(target: Record<string, unknown>, path: string[], value: string) {
  let cursor = target;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!key) continue;
    if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  const leaf = path[path.length - 1];
  if (leaf) cursor[leaf] = value;
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") ?? "";
  const raw = await req.text();
  if (!raw) return {};

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  const params = new URLSearchParams(raw);
  const dataParam = params.get("data");
  if (dataParam) {
    try {
      return { data: JSON.parse(dataParam) };
    } catch {
      return { data: dataParam };
    }
  }

  const body: Record<string, unknown> = {};
  for (const [key, value] of params.entries()) {
    const path = [...key.matchAll(/([^[\]]+)/g)].map((match) => match[1]);
    assignNested(body, path.length ? path : [key], value);
  }
  return body;
}

function getNested(body: Record<string, unknown>, path: string[]): unknown {
  return path.reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, body);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!PAYDUNYA_MASTER_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error("[paydunya-webhook] missing server configuration");
      return json({ error: "Webhook not configured" }, 500);
    }

    const body = await parseBody(req);
    const invoiceToken = String(
      getNested(body, ["data", "invoice", "token"]) ??
        getNested(body, ["data", "invoice_token"]) ??
        getNested(body, ["invoice_token"]) ??
        "",
    );
    const status = String(
      getNested(body, ["data", "status"]) ?? getNested(body, ["status"]) ?? "",
    ).toLowerCase();
    const hash = String(
      getNested(body, ["data", "hash"]) ?? getNested(body, ["hash"]) ?? "",
    ).toLowerCase();
    const paidAmount = Number(
      getNested(body, ["data", "invoice", "total_amount"]) ??
        getNested(body, ["data", "invoice", "total_amount_including_taxes"]) ??
        getNested(body, ["data", "total_amount"]) ??
        getNested(body, ["amount_xof"]) ??
        0,
    );

    const expectedHash = await sha512Hex(PAYDUNYA_MASTER_KEY);
    if (!hash || hash !== expectedHash) {
      console.warn("[paydunya-webhook] hash mismatch", { invoiceToken });
      return json({ error: "Unauthorized" }, 401);
    }

    if (!invoiceToken) return json({ error: "invoice_token manquant" }, 400);
    if (!status) return json({ error: "status manquant" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: txn, error: txnErr } = await supabase
      .from("payment_transactions")
      .select("id, agency_id, plan_id, amount_xof, phone, status, is_founder_cycle")
      .eq("invoice_token", invoiceToken)
      .maybeSingle();

    if (txnErr) {
      console.error("[paydunya-webhook] transaction lookup failed", txnErr.message);
      return json({ error: "DB error" }, 500);
    }
    if (!txn) return json({ error: "Transaction inconnue" }, 404);

    await supabase
      .from("payment_transactions")
      .update({ webhook_raw: body, provider_ref: invoiceToken, updated_at: new Date().toISOString() })
      .eq("id", txn.id);

    if (txn.status === "completed") {
      return json({ success: true, already_processed: true });
    }

    if (status === "completed" && paidAmount !== Number(txn.amount_xof)) {
      console.warn("[paydunya-webhook] amount mismatch", {
        invoiceToken,
        paidAmount,
        expected: txn.amount_xof,
      });
      return json({ error: "Amount mismatch" }, 422);
    }

    if (status === "completed") {
      const { error: activateErr } = await supabase.rpc("activate_subscription", {
        p_agency_id: txn.agency_id,
        p_plan_id: txn.plan_id,
        p_transaction_id: txn.id,
        p_amount_xof: txn.amount_xof,
        p_phone: txn.phone,
        p_is_founder_cycle: txn.is_founder_cycle ?? false,
      });

      if (activateErr) {
        console.error("[paydunya-webhook] activate_subscription failed", activateErr.message);
        return json({ error: "Activation failed", detail: activateErr.message }, 500);
      }

      await supabase.functions.invoke("send-email", {
        body: { trigger: "process_queue", agency_id: txn.agency_id },
      }).catch(() => {});

      return json({ success: true, activated: true });
    }

    if (["cancelled", "canceled", "failed"].includes(status)) {
      const normalizedStatus = status === "canceled" ? "cancelled" : status;
      if (txn.status === "pending") {
        await supabase
          .from("payment_transactions")
          .update({ status: normalizedStatus, updated_at: new Date().toISOString() })
          .eq("id", txn.id);
      }
      return json({ success: true, status: normalizedStatus });
    }

    return json({ success: true, status: "pending" });
  } catch (err) {
    console.error("[paydunya-webhook] unexpected error", err);
    return json({ error: "Erreur interne" }, 500);
  }
});
