/**
 * Edge Function : subscription-scheduler
 *
 * Orchestre les relances d'abonnement :
 *   - J-3 avant expiration → email rappel
 *   - J0 → suspension après 24h de grâce → email suspension
 *   - J+7 → email récupération
 *   - Rapport mensuel bailleurs → fin de mois
 *   - Rappels locataires J-5 → SMS + email
 *
 * Appelé par pg_cron ou manuellement depuis la Console super_admin.
 * Doit être invoqué avec le service role key.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const task = body?.task ?? "all";

    const results: Record<string, unknown> = {};

    // ── 1. Relances renouvellement ──────────────────────────────────────────
    if (task === "all" || task === "renewals") {
      const { data } = await supabase.rpc("queue_renewal_reminders");
      results.renewals = data;
    }

    // ── 2. Rappels locataires J-5 avant échéance ───────────────────────────
    if (task === "all" || task === "tenant_reminders") {
      // Contrats actifs dont le loyer est dû dans 5 jours (le 1er du mois suivant)
      const today = new Date();
      const dueDay = new Date(today.getFullYear(), today.getMonth() + 1, 1); // 1er du mois prochain
      const remindDay = new Date(dueDay.getTime() - 5 * 86400000); // J-5
      const isReminderDay =
        today.getDate() === remindDay.getDate() &&
        today.getMonth() === remindDay.getMonth();

      if (isReminderDay) {
        const { data: contrats } = await supabase
          .from("contrats")
          .select(`
            id, loyer_mensuel, date_echeance_jour,
            locataires (prenom, nom, telephone, email),
            unites (nom)
          `)
          .eq("statut", "actif");

        let tenantQueued = 0;
        for (const c of (contrats ?? []) as Record<string, unknown>[]) {
          const loc = c.locataires as Record<string, unknown> | null;
          const unite = c.unites as Record<string, unknown> | null;
          if (!loc?.telephone && !loc?.email) continue;

          const templateData = {
            locataire_prenom: loc.prenom,
            locataire_nom: `${loc.prenom} ${loc.nom}`,
            montant_loyer: c.loyer_mensuel,
            unite_nom: unite?.nom,
            date_echeance: `1er ${new Date(today.getFullYear(), today.getMonth() + 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`,
          };

          if (loc.email) {
            await supabase.from("notification_queue").insert({
              agency_id: c.agency_id,
              type: "rappel_locataire",
              channel: "email",
              recipient_email: loc.email,
              recipient_name: `${loc.prenom} ${loc.nom}`,
              subject: `Rappel loyer — Échéance dans 5 jours`,
              template_data: templateData,
            });
            tenantQueued++;
          }
          if (loc.telephone) {
            await supabase.from("notification_queue").insert({
              agency_id: c.agency_id,
              type: "rappel_locataire",
              channel: "sms",
              recipient_phone: loc.telephone as string,
              template_data: templateData,
            });
            tenantQueued++;
          }
        }
        results.tenant_reminders = { queued: tenantQueued };
      } else {
        results.tenant_reminders = { skipped: "not reminder day" };
      }
    }

    // ── 3. Alertes impayés agents (loyers > N jours sans paiement) ─────────
    if (task === "all" || task === "overdue_alerts") {
      const OVERDUE_DAYS = 10;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - OVERDUE_DAYS);
      const cutoffMonth = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-01`;

      const { data: impayes } = await supabase
        .from("paiements")
        .select(`
          id, montant_total, mois_concerne, agency_id,
          contrats (
            unites (nom),
            locataires (prenom, nom)
          )
        `)
        .eq("statut", "impaye")
        .lte("mois_concerne", cutoffMonth);

      let overdueQueued = 0;
      const agenciesAlerted = new Set<string>();

      for (const p of (impayes ?? []) as Record<string, unknown>[]) {
        if (agenciesAlerted.has(p.agency_id as string)) continue;
        agenciesAlerted.add(p.agency_id as string);

        const contrat = p.contrats as Record<string, unknown> | null;
        const loc = contrat?.locataires as Record<string, unknown> | null;
        const unite = contrat?.unites as Record<string, unknown> | null;

        const daysLate = Math.floor((Date.now() - new Date(p.mois_concerne as string).getTime()) / 86400000);

        // Vérifier si pas déjà alerté aujourd'hui
        const { count } = await supabase.from("notification_queue")
          .select("id", { count: "exact", head: true })
          .eq("agency_id", p.agency_id)
          .eq("type", "impaye_agent_alerte")
          .gte("created_at", new Date(Date.now() - 24 * 3600000).toISOString());

        if ((count ?? 0) > 0) continue;

        await supabase.from("notification_queue").insert({
          agency_id: p.agency_id,
          type: "impaye_agent_alerte",
          channel: "email",
          template_data: {
            locataire_nom: `${loc?.prenom ?? ""} ${loc?.nom ?? ""}`.trim(),
            unite_nom: unite?.nom,
            montant_total: p.montant_total,
            mois_concerne: p.mois_concerne,
            days_late: daysLate,
          },
        });
        overdueQueued++;
      }
      results.overdue_alerts = { queued: overdueQueued };
    }

    // ── 4. Déclencher les workers d'envoi ───────────────────────────────────
    await Promise.allSettled([
      supabase.functions.invoke("send-email"),
      supabase.functions.invoke("send-sms"),
    ]);

    return json({ success: true, task, results });
  } catch (err) {
    console.error("[subscription-scheduler] Erreur:", err);
    return json({ error: "Erreur interne", detail: String(err) }, 500);
  }
});
