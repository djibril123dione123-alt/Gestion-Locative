import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "npm:svix@1.24.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const payloadString = await req.text();
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return json({ error: "Missing svix headers" }, 400);
    }

    if (!RESEND_WEBHOOK_SECRET) {
      // Echouer ferme : accepter des evenements non verifies serait pire
      // que refuser temporairement le trafic tant que le secret manque.
      console.error("[resend-webhook] RESEND_WEBHOOK_SECRET is not configured");
      return json({ error: "Webhook not configured" }, 500);
    }

    const wh = new Webhook(RESEND_WEBHOOK_SECRET);
    try {
      wh.verify(payloadString, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
    } catch (err) {
      console.error("Invalid svix signature:", err);
      return json({ error: "Invalid signature" }, 400);
    }

    const body = JSON.parse(payloadString);
    const eventType = body.type; // e.g., email.sent, email.delivered
    const emailId = body.data?.email_id; // Resend email ID

    if (!emailId || !eventType) {
      return json({ error: "Missing email_id or type" }, 400);
    }

    // Deduplication atomique, une fois le payload valide : un svix-id
    // deja vu n'est jamais retraite, quel que soit le nombre de
    // livraisons ou de retries Resend. Le claim vient apres la
    // validation du payload pour qu'un evenement malforme (400) reste
    // rejouable plutot que d'etre silencieusement avale par le dedup.
    const { data: claimed, error: claimError } = await supabase
      .from("resend_webhook_events")
      .insert({ svix_id: svixId, event_type: eventType })
      .select("svix_id")
      .maybeSingle();

    if (claimError) {
      if (claimError.code === "23505") {
        return json({ message: "Event already processed" }, 200);
      }
      console.error("[resend-webhook] Dedup claim failed:", claimError);
      return json({ error: "Database error" }, 500);
    }
    if (!claimed) {
      return json({ message: "Event already processed" }, 200);
    }

    // Map Resend events to our status
    let status = "";
    let error = null;

    switch (eventType) {
      case "email.sent":
        status = "sent";
        break;
      case "email.delivered":
        status = "delivered";
        break;
      case "email.delivery_delayed":
        status = "delayed";
        break;
      case "email.bounced":
        status = "bounced";
        error = `Resend event: ${eventType}`;
        break;
      case "email.complained":
        status = "complained";
        error = `Resend event: ${eventType}`;
        break;
      case "email.suppressed":
        status = "suppressed";
        error = `Resend event: ${eventType}`;
        break;
      case "email.failed":
        status = "failed";
        error = `Resend event: ${eventType}`;
        break;
      default:
        return json({ message: "Event ignored" }, 200);
    }

    // Update notification_queue
    const updatePayload: any = { status };
    if (error) updatePayload.error = error;
    if (status === "sent") updatePayload.sent_at = new Date().toISOString();

    const { error: dbError } = await supabase
      .from("notification_queue")
      .update(updatePayload)
      .eq("provider_id", emailId);

    if (dbError) {
      console.error("[resend-webhook] DB Error:", dbError);
      return json({ error: "Database update failed" }, 500);
    }

    return json({ message: "Webhook processed" }, 200);
  } catch (err) {
    console.error("[resend-webhook] Error processing webhook:", err);
    return json({ error: "Internal Server Error" }, 500);
  }
});
