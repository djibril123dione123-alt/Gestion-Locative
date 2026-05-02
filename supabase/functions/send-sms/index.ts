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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const ORANGE_CLIENT_ID = Deno.env.get("ORANGE_SMS_CLIENT_ID") ?? "";
const ORANGE_CLIENT_SECRET = Deno.env.get("ORANGE_SMS_CLIENT_SECRET") ?? "";
const ORANGE_SENDER = Deno.env.get("ORANGE_SMS_SENDER") ?? "SamayKeur";
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
async function sendSms(to: string, message: string): Promise<string> {
  const token = await getOrangeToken();
  // Normaliser le numéro : +221XXXXXXXXX
  const phone = to.startsWith("+") ? to : `+221${to.replace(/\D/g, "").slice(-9)}`;
  const senderEncoded = encodeURIComponent(`tel:+221${ORANGE_SENDER}`);

  const res = await fetch(
    `https://api.orange.com/smsmessaging/v1/outbound/${senderEncoded}/requests`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        outboundSMSMessageRequest: {
          address: [`tel:${phone}`],
          senderAddress: `tel:+221${ORANGE_SENDER}`,
          outboundSMSTextMessage: { message },
          receiptRequest: { notifyURL: "", callbackData: "" },
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
        const resourceUrl = await sendSms(phone, message);
        await supabase.from("notification_queue").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_id: resourceUrl,
        }).eq("id", notif.id);
        sent++;
      } catch (smsErr) {
        const errMsg = String(smsErr);
        await supabase.from("notification_queue").update({
          status: notif.retry_count >= 3 ? "failed" : "pending",
          error: errMsg,
          retry_count: (notif.retry_count ?? 0) + 1,
          scheduled_for: new Date(Date.now() + 10 * 60_000).toISOString(),
        }).eq("id", notif.id);
        failed++;
        console.error(`[send-sms] Erreur pour ${notif.id}:`, errMsg);
      }
    }

    return json({ success: true, sent, failed, skipped });
  } catch (err) {
    console.error("[send-sms] Erreur inattendue:", err);
    return json({ error: "Erreur interne", detail: String(err) }, 500);
  }
});
