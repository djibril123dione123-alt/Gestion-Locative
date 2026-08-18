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
      .select(`
        bailleur_id, 
        agency_id, 
        recipient_email, 
        frequency, 
        send_day, 
        send_time, 
        timezone, 
        next_send_at, 
        bailleurs(nom, prenom),
        agencies(id)
      `)
      .eq("enabled", true)
      .or(`next_send_at.lte.${now.toISOString()},next_send_at.is.null`);

    if (setErr || !settings || settings.length === 0) {
      return new Response("No settings to process", { status: 200 });
    }

    // Get unique agency IDs to fetch communication preferences
    const agencyIds = [...new Set(settings.map(s => s.agency_id))];
    const { data: agencySettings } = await supabase
      .from("agency_settings")
      .select("agency_id, communications_email_enabled")
      .in("agency_id", agencyIds);

    const emailEnabledMap = new Map(agencySettings?.map(as => [as.agency_id, as.communications_email_enabled ?? true])); 
    const results = [];

    // On détermine le mois précédent car le rapport du mois M est envoyé au début du mois M+1
    const periodDate = new Date();
    periodDate.setMonth(periodDate.getMonth() - 1);
    const moisConcerne = periodDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const periodStart = new Date(Date.UTC(periodDate.getFullYear(), periodDate.getMonth(), 1)).toISOString().split('T')[0];
    const periodEnd = new Date(Date.UTC(periodDate.getFullYear(), periodDate.getMonth() + 1, 0)).toISOString().split('T')[0];

    for (const setting of settings) {
      const idempotencyKey = `rapport_mensuel_${setting.bailleur_id}_${moisConcerne.replace(' ', '_')}`;

      // Prévention des doublons via idempotency_key
      const { data: existing } = await supabase
        .from("notification_queue")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existing) {
        // Mettre à jour next_send_at pour ne pas boucler
        await updateNextSendAt(setting);
        continue;
      }

      // Générer le snapshot financier complet via l'implémentation autorisée
      // Cela évite de recréer une source de vérité financière tout en obtenant toutes les données
      const { data: snapshotData, error: snapErr } = await supabase.rpc('fn_create_owner_report_snapshot_authorized_impl', {
        p_agency_id: setting.agency_id,
        p_bailleur_id: setting.bailleur_id,
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_document_kind: 'rapport_bailleur'
      });

      if (snapErr || !snapshotData) {
        console.error("Erreur génération snapshot:", snapErr);
        continue;
      }

      // Extraire le payload du snapshot retourné par l'RPC
      const payload = snapshotData.payload || snapshotData;

      const total_encaisse = payload.totals?.collected || 0;
      const total_commission = payload.totals?.commission || 0;
      const total_depenses = payload.totals?.expenses || 0;
      const net_reverser = payload.totals?.net || 0;
      
      const bailleur_nom = `${setting.bailleurs?.prenom ?? ""} ${setting.bailleurs?.nom ?? ""}`.trim() || "Bailleur";

      // Créer une entrée préparatoire dans document_registry pour accès sécurisé (expiration dans 30 jours)
      const secureToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      const { error: docErr } = await supabase.from("document_registry").insert({
        agency_id: setting.agency_id,
        reference: `RAPPORT-${setting.bailleur_id.substring(0,8).toUpperCase()}-${moisConcerne.replace(' ', '').toUpperCase()}`,
        type: "rapport_gérance",
        metadata: { bailleur_id: setting.bailleur_id, mois_concerne: moisConcerne, report_payload: payload },
        secure_token: secureToken,
        expires_at: expiresAt.toISOString(),
      });
      
      if (docErr) {
        console.error("Erreur création document_registry", docErr);
        continue;
      }

      // Check communication preferences before enqueuing email
      const emailEnabled = emailEnabledMap.get(setting.agency_id);
      
      if (emailEnabled) {
        // Créer la notification email
        const { error: insertErr } = await supabase.from("notification_queue").insert({
          agency_id: setting.agency_id,
          type: "rapport_mensuel",
          channel: "email",
          recipient_email: setting.recipient_email,
          recipient_name: bailleur_nom,
          subject: `Rapport mensuel ${moisConcerne}`,
          idempotency_key: idempotencyKey,
          context_type: "rapport_bailleur",
          context_id: setting.bailleur_id, // we use bailleur_id or document_registry id? bailleur_id is fine.
          template_data: {
            bailleur_nom,
            mois_concerne: moisConcerne,
            total_encaisse,
            total_commission,
            total_depenses,
            net_reverser,
            magic_link: `${APP_URL}/#/shared/rapport?token=${secureToken}`
          }
        });
        
        if (insertErr) {
          console.error("Erreur insertion notif", insertErr);
        }
      }

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
  // Parsing de l'heure d'envoi configurée
  const timeStr = setting.send_time || '08:00';
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Base calculation relative to UTC (simple approach as Deno runs in UTC)
  // To strictly respect timezone we'd use Temporal API or external library,
  // but a simplified offset based approach is usually sufficient for month+day precision.
  const next = new Date();
  
  if (setting.frequency === 'monthly') {
    next.setUTCMonth(next.getUTCMonth() + 1);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 3);
  }
  
  next.setUTCDate(setting.send_day ?? 1);
  next.setUTCHours(hours, minutes || 0, 0, 0);

  await supabase
    .from("landlord_report_settings")
    .update({ 
      last_sent_at: new Date().toISOString(),
      next_send_at: next.toISOString() 
    })
    .eq("bailleur_id", setting.bailleur_id);
}
