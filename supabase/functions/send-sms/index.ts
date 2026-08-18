/**
 * Edge Function : send-sms
 *
 * Worker d'envoi de SMS via Orange SMS API (Afrique francophone).
 * Traite la notification_queue (channel=sms, status=pending).
 *
 * Orange SMS API :
 *   POST https://api.orange.com/smsmessaging/v1/outbound/{senderAddress}/requests
 *   Auth : OAuth2 Client Credentials (client_id → access_token)
 *
 * Templates SMS supportés :
 *   rappel_locataire : "Bonjour [prénom], votre loyer de [montant] est dû le [date]. Merci."
 *   impaye_agent_alerte : résumé impayé
 *   renewal_reminder : rappel renouvellement abonnement
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logError } from "../_shared/sentry.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const ORANGE_CLIENT_ID = Deno.env.get("ORANGE_SMS_CLIENT_ID") ?? "";
const ORANGE_CLIENT_SECRET = Deno.env.get("ORANGE_SMS_CLIENT_SECRET") ?? "";
const ORANGE_SENDER_ADDRESS = Deno.env.get("ORANGE_SMS_SENDER_ADDRESS") ?? ""; // Ex: tel:+22100000000 ou devapi shortcode
const ORANGE_SENDER_NAME = Deno.env.get("ORANGE_SMS_SENDER_NAME") ?? "SamayKeur";
const ORANGE_WEBHOOK_SECRET = Deno.env.get("ORANGE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

// ─── Obtenir un token Orange OAuth2 ──────────────────────────────────────────
let _orangeToken: string | null = null;
let _orangeTokenExpiry = 0;

async function getOrangeToken(): Promise<string> {
  if (_orangeToken && Date.now() < _orangeTokenExpiry) return _orangeToken;

  const creds = btoa(`${ORANGE_CLIENT_ID}:${ORANGE_CLIENT_SECRET}`);
  const res = await fetch("https://api.orange.com/oauth/v3/token", {
    method: "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`Orange OAuth error: ${res.status}`);
  const data = await res.json();
  _orangeToken = data.access_token;
  _orangeTokenExpiry = Date.now() + (Number(data.expires_in ?? 3600) - 60) * 1000;
  return _orangeToken!;
}

// ─── Envoi SMS ────────────────────────────────────────────────────────────────
async function sendSms(to: string, message: string, notifId: string): Promise<string> {
  const token = await getOrangeToken();
  
  // Normaliser le numéro (Sénégal uniquement selon les règles métier)
  const cleaned = to.replace(/\D/g, "");
  let phone = "";
  
  // Extraire les 9 derniers chiffres (le numéro local)
  const localNum = cleaned.length >= 9 ? cleaned.slice(-9) : cleaned;
  
  // Vérifier strictement le format sénégalais (77, 78, 76, 75, 70)
  if (!/^(77|78|76|75|70)\d{7}$/.test(localNum)) {
    throw new Error(`VALIDATION_ERROR: Format de numéro invalide pour le Sénégal: ${to}`);
  }
  
  phone = `+221${localNum}`;

  // Si on n'a pas de SENDER_ADDRESS configuré (ex: environnement dev), on fallback sur le format Orange Dev ou un numéro bidon
  const senderAddress = ORANGE_SENDER_ADDRESS || `tel:+22100000000`;
  const senderEncoded = encodeURIComponent(senderAddress);

  const res = await fetch(
    `https://api.orange.com/smsmessaging/v1/outbound/${senderEncoded}/requests`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        outboundSMSMessageRequest: {
          address: [`tel:${phone}`],
          senderAddress: senderAddress,
          senderName: ORANGE_SENDER_NAME,
          outboundSMSTextMessage: { message },
          receiptRequest: { 
            notifyURL: `${SUPABASE_URL}/functions/v1/orangesms-webhook?token=${encodeURIComponent(ORANGE_WEBHOOK_SECRET)}`, 
            callbackData: notifId 
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Orange SMS error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data?.outboundSMSMessageRequest?.resourceURL ?? "ok";
}

// ─── Templates SMS ────────────────────────────────────────────────────────────
function buildSms(type: string, data: Record<string, unknown>): string | null {
  switch (type) {
    case "rappel_locataire":
      return `Bonjour ${data.locataire_prenom}, votre loyer de ${Number(data.montant_loyer ?? 0).toLocaleString("fr-FR")} XOF est dû le ${data.date_echeance}. Merci. — Samay Këur`;

    case "impaye_agent_alerte":
      return `[Samay Këur] Loyer impayé : ${data.locataire_nom} — ${Number(data.montant_total ?? 0).toLocaleString("fr-FR")} XOF depuis ${data.days_late}j. Unité : ${data.unite_nom}.`;

    case "renewal_reminder":
      return `[Samay Këur] Votre abonnement expire dans ${data.days_left} jours. Renouvelez via l'app pour continuer à gérer vos locations.`;

    default:
      return null;
  }
}

interface SmsNotif {
  id: string;
  agency_id: string;
  type: string;
  recipient_phone: string | null;
  template_data: Record<string, unknown>;
  retry_count: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!ORANGE_CLIENT_ID) {
    return json({ error: "ORANGE_SMS_CLIENT_ID non configuré" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  let sent = 0, failed = 0, skipped = 0;

  try {
    const { data: pending } = await supabase
      .from("notification_queue")
      .select("id, agency_id, type, recipient_phone, template_data, retry_count")
      .eq("channel", "sms")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(20);

    for (const notif of (pending ?? []) as SmsNotif[]) {
      const phone = notif.recipient_phone;
      if (!phone) {
        await supabase.from("notification_queue").update({ status: "skipped" }).eq("id", notif.id);
        skipped++;
        continue;
      }

      const message = buildSms(notif.type, notif.template_data ?? {});
      if (!message) {
        await supabase.from("notification_queue").update({ status: "skipped" }).eq("id", notif.id);
        skipped++;
        continue;
      }

      try {
        const providerId = await sendSms(phone, message, notif.id);
        await supabase.from("notification_queue").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider: "orange_sms",
          provider_message_id: providerId,
        }).eq("id", notif.id);
        sent++;
      } catch (smsErr) {
        const errMsg = String(smsErr);
        const isValidationError = errMsg.includes('VALIDATION_ERROR:');
        
        // Exponentiel backoff: 15min, 30min, 60min, etc.
        const backoffMinutes = 15 * Math.pow(2, notif.retry_count ?? 0);
        
        await supabase.from("notification_queue").update({
          status: (isValidationError || notif.retry_count >= 3) ? "failed" : "pending",
          error: errMsg,
          provider: "orange_sms",
          failed_at: (isValidationError || notif.retry_count >= 3) ? new Date().toISOString() : null,
          retry_count: (notif.retry_count ?? 0) + 1,
          scheduled_for: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
        }).eq("id", notif.id);
        failed++;
        logError("send-sms", "SMS error for " + notif.id, errMsg);
      }
    }

    return json({ processed: sent + failed + skipped, sent, failed, skipped });
  } catch (err: any) {
    logError("send-sms", "Worker error", err);
    return json({ error: "Erreur interne", detail: String(err) }, 500);
  }
});
