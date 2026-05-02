/**
 * Edge Function : finance-worker
 *
 * Worker financier invocable manuellement (depuis l'Audit Dashboard)
 * ou par une requête HTTP schedulée (Supabase Hooks / pg_net).
 *
 * Exécute :
 *   - fn_worker_finance()  → GENERATE_LEDGER + RECONCILE_FINANCE
 *   - fn_compute_financial_snapshots() pour la période courante
 *
 * Requiert : rôle admin ou super_admin
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
function err(message: string, status = 400, code?: string) {
  return json({ error: message, ...(code ? { code } : {}) }, status);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return err("POST requis.", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return err("Token manquant.", 401, "NOT_AUTHENTICATED");
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) return err("Token invalide.", 401, "INVALID_TOKEN");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, actif")
      .eq("id", user.id)
      .single();

    if (!profile?.actif) return err("Compte désactivé.", 403);
    if (!["admin", "super_admin"].includes(profile?.role ?? "")) {
      return err("Rôle admin requis.", 403, "FORBIDDEN_ROLE");
    }

    const startedAt = Date.now();

    // 1. Process finance jobs
    const { data: workerResult } = await supabaseAdmin
      .rpc("fn_worker_finance", { p_batch_size: 20 });

    // 2. Reconciliation snapshot pour ce mois
    const { data: snapshotResult } = await supabaseAdmin
      .rpc("fn_compute_financial_snapshots", {
        p_period: new Date().toISOString().slice(0, 7) + "-01",
      });

    // 3. Log dans event_outbox
    await supabaseAdmin.from("event_outbox").insert({
      event_type: "worker.finance.run",
      entity_type: "job_queue",
      payload: { worker: workerResult, snapshot: snapshotResult, duration_ms: Date.now() - startedAt },
      source: "edge-function",
      status: "processed",
      processed_at: new Date().toISOString(),
    }).catch(() => {});

    return json({
      success: true,
      worker: workerResult,
      duration_ms: Date.now() - startedAt,
    }, 200);
  } catch (_err) {
    return err("Erreur serveur inattendue.", 500, "INTERNAL_ERROR");
  }
});
