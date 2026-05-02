/**
 * Edge Function : notification-worker
 *
 * Worker notifications V3.1 — stateless, simple
 * Traite les jobs SEND_NOTIFICATION depuis job_queue :
 *   - quittances de loyer
 *   - alertes impayés
 *   - notifications agence
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
function err(msg: string, status = 400, code?: string) {
  return json({ error: msg, ...(code ? { code } : {}) }, status);
}

interface NotificationJob {
  id: string;
  type: string;
  agency_id: string;
  payload: {
    notification_type?: "quittance" | "impaye_alerte" | "agence_info";
    contrat_id?: string;
    paiement_id?: string;
    message?: string;
    recipient_id?: string;
  };
  trace_id: string | null;
  retry_count: number;
  max_retries: number;
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
      .from("user_profiles")
      .select("role, actif")
      .eq("id", user.id)
      .single();

    if (!profile?.actif) return err("Compte désactivé.", 403);
    if (!["admin", "super_admin"].includes(profile?.role ?? "")) {
      return err("Rôle admin requis.", 403, "FORBIDDEN_ROLE");
    }

    const startedAt = Date.now();
    let processed = 0;
    let failed = 0;

    // Récupère les jobs SEND_NOTIFICATION en attente
    const { data: jobs } = await supabaseAdmin
      .from("job_queue")
      .select("id, type, agency_id, payload, trace_id, retry_count, max_retries")
      .eq("type", "SEND_NOTIFICATION")
      .eq("status", "pending")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(50);

    for (const job of (jobs as NotificationJob[]) ?? []) {
      // Marquer en cours
      await supabaseAdmin
        .from("job_queue")
        .update({ status: "processing", started_at: new Date().toISOString() })
        .eq("id", job.id);

      try {
        const notifType = job.payload?.notification_type ?? "agence_info";

        // Insérer la notification dans event_log (audit)
        await supabaseAdmin.from("event_log").insert({
          event_type: `notification.${notifType}`,
          entity_type: "notification",
          entity_id: job.id,
          agency_id: job.agency_id,
          payload: job.payload,
          source: "notification-worker",
          trace_id: job.trace_id,
        }).throwOnError();

        // Marquer done
        await supabaseAdmin
          .from("job_queue")
          .update({ status: "done", completed_at: new Date().toISOString() })
          .eq("id", job.id);

        processed++;
      } catch (jobErr) {
        const isRetryable = job.retry_count < job.max_retries;
        await supabaseAdmin
          .from("job_queue")
          .update({
            status: isRetryable ? "pending" : "failed",
            retry_count: job.retry_count + 1,
            next_retry_at: isRetryable
              ? new Date(Date.now() + (job.retry_count + 1) * 5 * 60_000).toISOString()
              : null,
            error: String(jobErr),
          })
          .eq("id", job.id);
        failed++;
      }
    }

    // Health snapshot passif
    await supabaseAdmin.rpc("fn_snapshot_health").catch(() => {});

    // Log dans event_outbox
    await supabaseAdmin.from("event_outbox").insert({
      event_type: "worker.notification.run",
      entity_type: "job_queue",
      payload: { processed, failed, duration_ms: Date.now() - startedAt },
      source: "edge-function",
      status: "processed",
      processed_at: new Date().toISOString(),
    }).catch(() => {});

    return json({ success: true, processed, failed, duration_ms: Date.now() - startedAt });
  } catch (_err) {
    return err("Erreur serveur inattendue.", 500, "INTERNAL_ERROR");
  }
});
