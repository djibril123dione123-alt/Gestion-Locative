import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? ""; // To be verified if SVIX signature validation is added

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const eventType = body.type; // e.g., email.sent, email.delivered
    const emailId = body.data?.email_id; // Resend email ID

    if (!emailId || !eventType) {
      return json({ error: "Missing email_id or type" }, 400);
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
        status = "pending";
        break;
      case "email.bounced":
      case "email.failed":
      case "email.complained":
      case "email.suppressed":
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
