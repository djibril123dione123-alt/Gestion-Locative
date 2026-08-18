import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("VITE_APP_URL") ?? "https://app.samaykeur.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  try {
    // 1. Récupérer les paramètres d'envoi échus
    const now = new Date();
    const { data: settings, error: setErr } = await supabase
      .from("landlord_report_settings")
      .select("bailleur_id, agency_id, recipient_email, frequency, send_day, next_send_at, bailleurs(nom, prenom)")
      .eq("enabled", true)
      .or(`next_send_at.lte.${now.toISOString()},next_send_at.is.null`);

    if (setErr) throw setErr;
    if (!settings || settings.length === 0) return new Response(JSON.stringify({ message: "No reports due" }), { status: 200 });

    const results = [];

    // On détermine le mois précédent car le rapport du mois M est envoyé au début du mois M+1
    const periodDate = new Date();
    periodDate.setMonth(periodDate.getMonth() - 1);
    const moisConcerne = periodDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    for (const setting of settings) {
      // Prévention des doublons : vérifier si un rapport pour cette période a déjà été mis en file d'attente
      const { data: existing } = await supabase
        .from("notification_queue")
        .select("id")
        .eq("agency_id", setting.agency_id)
        .eq("type", "rapport_mensuel")
        .eq("recipient_email", setting.recipient_email)
        .contains("template_data", { mois_concerne: moisConcerne })
        .maybeSingle();

      if (existing) {
        // Mettre à jour next_send_at pour ne pas boucler
        await updateNextSendAt(setting);
        continue;
      }

      // Récupérer les statistiques
      const { data: stats } = await supabase
        .from("vw_owner_agency_stats")
        .select("encaisse, commission_agence, part_bailleur") // simplified columns
        .eq("bailleur_id", setting.bailleur_id)
        .maybeSingle();
      
      const total_encaisse = stats?.encaisse ?? 0;
      const total_commission = stats?.commission_agence ?? 0;
      const total_depenses = 0; // if tracked
      const net_reverser = stats?.part_bailleur ?? 0;
      
      const bailleur_nom = `${setting.bailleurs?.prenom ?? ""} ${setting.bailleurs?.nom ?? ""}`.trim() || "Bailleur";

      // Créer la notification
      const { error: insertErr } = await supabase.from("notification_queue").insert({
        agency_id: setting.agency_id,
        type: "rapport_mensuel",
        channel: "email",
        recipient_email: setting.recipient_email,
        recipient_name: bailleur_nom,
        subject: `Rapport mensuel ${moisConcerne}`,
        template_data: {
          bailleur_nom,
          mois_concerne: moisConcerne,
          total_encaisse,
          total_commission,
          total_depenses,
          net_reverser,
          magic_link: `${APP_URL}/` // Ideally points to a public verification portal
        }
      });

      if (!insertErr) {
        await updateNextSendAt(setting);
        results.push({ bailleur_id: setting.bailleur_id, status: "queued" });
      }
    }

    return new Response(JSON.stringify({ processed: results }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[landlord-report-worker] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

async function updateNextSendAt(setting: any) {
  const next = new Date();
  if (setting.frequency === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setMonth(next.getMonth() + 3);
  }
  next.setDate(setting.send_day ?? 1);
  next.setHours(8, 0, 0, 0);

  await supabase
    .from("landlord_report_settings")
    .update({ 
      last_sent_at: new Date().toISOString(),
      next_send_at: next.toISOString() 
    })
    .eq("bailleur_id", setting.bailleur_id);
}
