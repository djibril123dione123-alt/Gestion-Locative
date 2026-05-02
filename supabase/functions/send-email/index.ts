/**
 * Edge Function : send-email
 *
 * Worker d'envoi d'emails via Resend API.
 * Traite la notification_queue en batch (type=email, status=pending).
 *
 * Peut être appelé :
 *   - Par pg_cron toutes les 5 min
 *   - Par le webhook PayDunya après activation
 *   - Par create-paiement après encaissement
 *
 * Templates supportés :
 *   welcome_email, payment_confirmed, renewal_reminder,
 *   suspension_warning, suspension_notice, recovery_email,
 *   loyer_encaisse_bailleur, rapport_mensuel, impaye_agent_alerte
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FROM_EMAIL = "Samay Këur <no-reply@samaykeur.sn>";
const APP_URL = Deno.env.get("APP_URL") ?? "https://samaykeur.replit.app";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

// ─── Formatage devise XOF ─────────────────────────────────────────────────────
function fmtXof(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(amount);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Templates HTML ───────────────────────────────────────────────────────────
function baseHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body { margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f8f9fa; color:#1a1a2e; }
  .wrap { max-width:600px; margin:32px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
  .header { background:linear-gradient(135deg,#F58220,#E65100); padding:32px 24px; text-align:center; }
  .header h1 { margin:0; color:#fff; font-size:24px; font-weight:700; }
  .header p { margin:8px 0 0; color:rgba(255,255,255,.85); font-size:14px; }
  .body { padding:32px 24px; }
  .card { background:#f8f9fa; border-radius:12px; padding:20px; margin:20px 0; border-left:4px solid #F58220; }
  .stat { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #e9ecef; }
  .stat:last-child { border-bottom:none; }
  .stat-label { color:#6c757d; font-size:14px; }
  .stat-value { font-weight:600; font-size:14px; }
  .btn { display:inline-block; padding:14px 28px; background:linear-gradient(135deg,#F58220,#E65100); color:#fff; text-decoration:none; border-radius:8px; font-weight:600; font-size:16px; margin:20px 0; }
  .footer { background:#f8f9fa; padding:20px 24px; text-align:center; color:#6c757d; font-size:12px; border-top:1px solid #e9ecef; }
  .amount-big { font-size:36px; font-weight:700; color:#F58220; text-align:center; margin:16px 0; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>🏢 Samay Këur</h1>
    <p>Plateforme de gestion locative</p>
  </div>
  <div class="body">${body}</div>
  <div class="footer">
    <p>Samay Këur — Gestion locative pour l'Afrique francophone</p>
    <p>Questions ? <a href="mailto:support@samaykeur.sn" style="color:#F58220">support@samaykeur.sn</a></p>
  </div>
</div>
</body></html>`;
}

interface NotifRow {
  id: string;
  agency_id: string;
  type: string;
  recipient_email: string | null;
  recipient_name: string | null;
  subject: string | null;
  template_data: Record<string, unknown>;
}

function buildEmail(notif: NotifRow): { subject: string; html: string } | null {
  const d = notif.template_data ?? {};

  switch (notif.type) {
    case "welcome_email": {
      const agencyName = String(d.agency_name ?? "votre agence");
      return {
        subject: `Bienvenue sur Samay Këur — Votre essai gratuit commence maintenant`,
        html: baseHtml("Bienvenue", `
          <h2 style="color:#1a1a2e;margin-top:0">Bienvenue ${String(d.contact_name ?? "")} !</h2>
          <p>Votre agence <strong>${agencyName}</strong> est configurée. Vous avez <strong>14 jours d'essai gratuit</strong> pour explorer toutes les fonctionnalités.</p>
          <div class="card">
            <div class="stat"><span class="stat-label">Plan</span><span class="stat-value">Essai gratuit 14 jours</span></div>
            <div class="stat"><span class="stat-label">Fin d'essai</span><span class="stat-value">${d.trial_ends_at ? fmtDate(String(d.trial_ends_at)) : "Dans 14 jours"}</span></div>
          </div>
          <p>Pour commencer, ajoutez votre premier bailleur et immeuble :</p>
          <a href="${APP_URL}" class="btn">Accéder à l'application</a>
          <p style="font-size:13px;color:#6c757d">Des questions ? Répondez directement à cet email — nous répondons sous 24h.</p>
        `),
      };
    }

    case "payment_confirmed": {
      return {
        subject: `✅ Paiement confirmé — Abonnement Pro activé`,
        html: baseHtml("Paiement confirmé", `
          <h2 style="color:#1a1a2e;margin-top:0">Paiement reçu !</h2>
          <div class="amount-big">${fmtXof(Number(d.amount_xof ?? 15000))}</div>
          <div class="card">
            <div class="stat"><span class="stat-label">Plan</span><span class="stat-value">Pro — Accès complet</span></div>
            <div class="stat"><span class="stat-label">Valide jusqu'au</span><span class="stat-value">${d.period_end ? fmtDate(String(d.period_end)) : "30 jours"}</span></div>
          </div>
          <a href="${APP_URL}" class="btn">Accéder à l'application</a>
        `),
      };
    }

    case "renewal_reminder": {
      const daysLeft = Number(d.days_left ?? 3);
      return {
        subject: `⚠️ Votre abonnement expire dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}`,
        html: baseHtml("Renouvellement", `
          <h2 style="color:#1a1a2e;margin-top:0">Renouvelez votre abonnement</h2>
          <p>Votre abonnement <strong>Pro</strong> expire le <strong>${d.next_renewal_at ? fmtDate(String(d.next_renewal_at)) : "bientôt"}</strong>.</p>
          <p>Pour éviter toute interruption de service, renouvelez dès maintenant :</p>
          <a href="${APP_URL}/#/abonnement" class="btn">Renouveler — ${fmtXof(15000)} / mois</a>
          <p style="font-size:13px;color:#6c757d">Vous pouvez payer via Orange Money directement depuis l'application.</p>
        `),
      };
    }

    case "suspension_warning": {
      return {
        subject: `🔴 Compte suspendu — Régularisez pour continuer`,
        html: baseHtml("Compte suspendu", `
          <h2 style="color:#dc3545;margin-top:0">Votre compte a été suspendu</h2>
          <p>Votre abonnement est arrivé à expiration. Votre compte est temporairement suspendu.</p>
          <p>Vos données sont conservées. Réactivez votre abonnement pour y accéder de nouveau :</p>
          <a href="${APP_URL}/#/abonnement" class="btn">Réactiver — ${fmtXof(15000)} / mois</a>
        `),
      };
    }

    case "recovery_email": {
      return {
        subject: `Nous gardons vos données — Revenez sur Samay Këur`,
        html: baseHtml("Retour", `
          <h2 style="color:#1a1a2e;margin-top:0">Vos données vous attendent</h2>
          <p>Cela fait 7 jours que votre compte est suspendu. Vos données sont toujours là, sécurisées.</p>
          <p>Réactivez votre abonnement à tout moment :</p>
          <a href="${APP_URL}/#/abonnement" class="btn">Réactiver mon compte</a>
        `),
      };
    }

    case "loyer_encaisse_bailleur": {
      return {
        subject: `💰 Loyer encaissé — ${d.unite_nom}`,
        html: baseHtml("Loyer encaissé", `
          <h2 style="color:#1a1a2e;margin-top:0">Bonjour ${d.bailleur_nom},</h2>
          <p>Un loyer a été encaissé pour votre bien <strong>${d.unite_nom}</strong>.</p>
          <div class="card">
            <div class="stat"><span class="stat-label">Mois</span><span class="stat-value">${d.mois_concerne ? fmtDate(String(d.mois_concerne)) : ""}</span></div>
            <div class="stat"><span class="stat-label">Montant total</span><span class="stat-value">${fmtXof(Number(d.montant_total ?? 0))}</span></div>
            <div class="stat"><span class="stat-label">Commission agence (${d.commission}%)</span><span class="stat-value">- ${fmtXof(Number(d.part_agence ?? 0))}</span></div>
            <div class="stat"><span class="stat-label" style="font-weight:700">Votre part</span><span class="stat-value" style="color:#28a745;font-size:18px;font-weight:700">${fmtXof(Number(d.part_bailleur ?? 0))}</span></div>
          </div>
          <a href="${APP_URL}" class="btn">Voir le détail</a>
        `),
      };
    }

    case "impaye_agent_alerte": {
      return {
        subject: `🚨 Impayé depuis ${d.days_late} jours — ${d.locataire_nom}`,
        html: baseHtml("Alerte impayé", `
          <h2 style="color:#dc3545;margin-top:0">Loyer impayé détecté</h2>
          <div class="card">
            <div class="stat"><span class="stat-label">Locataire</span><span class="stat-value">${d.locataire_nom}</span></div>
            <div class="stat"><span class="stat-label">Unité</span><span class="stat-value">${d.unite_nom}</span></div>
            <div class="stat"><span class="stat-label">Mois</span><span class="stat-value">${d.mois_concerne}</span></div>
            <div class="stat"><span class="stat-label">Montant dû</span><span class="stat-value" style="color:#dc3545">${fmtXof(Number(d.montant_total ?? 0))}</span></div>
            <div class="stat"><span class="stat-label">En retard depuis</span><span class="stat-value">${d.days_late} jours</span></div>
          </div>
          <a href="${APP_URL}/#/loyers-impayes" class="btn">Gérer les impayés</a>
        `),
      };
    }

    default:
      return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!RESEND_API_KEY) {
    return json({ error: "RESEND_API_KEY non configurée" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let sent = 0, failed = 0, skipped = 0;

  try {
    // Récupérer les notifications email en attente (batch 30)
    const { data: pending } = await supabase
      .from("notification_queue")
      .select("id, agency_id, type, recipient_email, recipient_name, subject, template_data")
      .eq("channel", "email")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(30);

    for (const notif of (pending ?? []) as NotifRow[]) {
      // Résoudre l'email destinataire si absent (admin de l'agence)
      let toEmail = notif.recipient_email;
      let toName = notif.recipient_name ?? "Utilisateur";

      if (!toEmail) {
        const { data: admin } = await supabase
          .from("user_profiles")
          .select("email, prenom, nom")
          .eq("agency_id", notif.agency_id)
          .in("role", ["admin", "agent"])
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!admin?.email) {
          await supabase.from("notification_queue").update({ status: "skipped", sent_at: new Date().toISOString() }).eq("id", notif.id);
          skipped++;
          continue;
        }
        toEmail = admin.email;
        toName = `${admin.prenom ?? ""} ${admin.nom ?? ""}`.trim() || toEmail;
      }

      // Enrichir template_data avec agency info si besoin
      if (!notif.template_data?.agency_name) {
        const { data: agency } = await supabase.from("agencies").select("name, trial_ends_at").eq("id", notif.agency_id).maybeSingle();
        if (agency) {
          notif.template_data = { ...notif.template_data, agency_name: agency.name, trial_ends_at: agency.trial_ends_at };
        }
      }

      const email = buildEmail(notif);
      if (!email) {
        await supabase.from("notification_queue").update({ status: "skipped" }).eq("id", notif.id);
        skipped++;
        continue;
      }

      // Envoi via Resend
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [`${toName} <${toEmail}>`],
          subject: notif.subject ?? email.subject,
          html: email.html,
        }),
      });

      const resendBody = await resendRes.json();

      if (resendRes.ok) {
        await supabase.from("notification_queue").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_id: resendBody.id ?? null,
        }).eq("id", notif.id);
        sent++;
      } else {
        const errorMsg = resendBody?.message ?? resendBody?.error ?? "Resend error";
        await supabase.from("notification_queue").update({
          status: notif.retry_count >= 3 ? "failed" : "pending",
          error: errorMsg,
          retry_count: (notif.retry_count ?? 0) + 1,
          scheduled_for: new Date(Date.now() + 15 * 60_000).toISOString(),
        }).eq("id", notif.id);
        failed++;
        console.error(`[send-email] Resend error for ${notif.id}:`, errorMsg);
      }
    }

    return json({ success: true, sent, failed, skipped });
  } catch (err) {
    console.error("[send-email] Erreur:", err);
    return json({ error: "Erreur interne", detail: String(err) }, 500);
  }
});
