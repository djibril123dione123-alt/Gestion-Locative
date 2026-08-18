import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logError } from "../_shared/sentry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const ORANGE_WEBHOOK_SECRET = Deno.env.get("ORANGE_WEBHOOK_SECRET") ?? "";

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!ORANGE_WEBHOOK_SECRET || token !== ORANGE_WEBHOOK_SECRET) {
    console.warn("[orangesms-webhook] Invalid or missing webhook token");
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json();
    
    // Controlled Test Route for Security Hardening
    if (body.test_error === true) {
        const dummySensitiveData = {
            message: "This is a controlled error test",
            jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
            password: "supersecretpassword123",
            cni: "1234567890123"
        };
        throw new Error("Controlled Edge Function Error: " + JSON.stringify(dummySensitiveData));
    }

    const deliveryInfoNotification = body.deliveryInfoNotification;
    
    if (!deliveryInfoNotification) {
      return json({ error: "Missing deliveryInfoNotification" }, 400);
    }

    const notifId = deliveryInfoNotification.callbackData;
    const deliveryStatus = deliveryInfoNotification.deliveryInfo?.deliveryStatus;

    if (!notifId) {
      return json({ error: "Missing callbackData (notifId)" }, 400);
    }

    let status = "sent";
    let errorMsg = null;
    let deliveredAt = null;
    let failedAt = null;
    let errorCode = null;

    // Orange status values (DeliveredToTerminal, DeliveredToNetwork, DeliveryImpossible, MessageWaiting)
    if (deliveryStatus === "DeliveredToTerminal" || deliveryStatus === "DeliveredToNetwork") {
      status = "delivered"; 
      deliveredAt = new Date().toISOString();
    } else if (deliveryStatus === "DeliveryImpossible" || deliveryStatus === "MessageWaiting") {
      status = "failed";
      errorMsg = `Delivery failed: ${deliveryStatus}`;
      errorCode = deliveryStatus;
      failedAt = new Date().toISOString();
    }

    const updatePayload: any = {};
    if (status === "failed") {
      updatePayload.status = "failed";
      updatePayload.error = errorMsg;
      updatePayload.error_code = errorCode;
      updatePayload.failed_at = failedAt;
    } else if (status === "delivered") {
      updatePayload.status = "delivered"; 
      updatePayload.delivered_at = deliveredAt;
    }

    const { error: dbError } = await supabase
      .from("notification_queue")
      .update(updatePayload)
      .eq("id", notifId);

    if (dbError) {
      console.error("[orangesms-webhook] DB Error:", dbError);
      logError("orangesms-webhook", "Database update failed", dbError);
      return json({ error: "Database update failed" }, 500);
    }

    return json({ message: "Webhook processed" }, 200);
  } catch (err) {
    logError("orangesms-webhook", err);
    return json({ error: "Internal Server Error" }, 500);
  }
});
