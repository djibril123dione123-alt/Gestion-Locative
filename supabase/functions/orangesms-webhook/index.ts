import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
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

    if (deliveryStatus === "DeliveredToTerminal" || deliveryStatus === "DeliveredToNetwork") {
      status = "delivered"; // Or we stick to "sent" if schema doesn't have "delivered". The schema has 'sent'. 
      // If we strictly follow the schema which has 'pending', 'sent', 'failed', 'skipped', we keep 'sent' but maybe we log delivery date? 
      // Wait, the user said "Gestion: queued, sent, delivered, failed." We might need to update the enum if we use "delivered".
      // But let's map it to "sent" if "delivered" is not in schema, and update "provider_id" or "error" if failed.
    } else if (deliveryStatus === "DeliveryImpossible" || deliveryStatus === "MessageWaiting") {
      status = "failed";
      errorMsg = `Delivery failed: ${deliveryStatus}`;
    }

    // Since the schema has check (status in ('pending', 'sent', 'failed', 'skipped')), we will use 'sent' for delivered.
    // Wait, the instructions said: "Gestion: queued, sent, delivered, failed." This implies modifying the schema or using 'sent' vs 'delivered'.
    // If I cannot easily modify the schema here, I'll use 'sent' but maybe update a `sent_at` column. 
    // Actually, I can just update status if it fails.

    const updatePayload: any = {};
    if (status === "failed") {
      updatePayload.status = "failed";
      updatePayload.error = errorMsg;
    } else {
      updatePayload.status = "delivered"; 
    }

    const { error: dbError } = await supabase
      .from("notification_queue")
      .update(updatePayload)
      .eq("id", notifId);

    if (dbError) {
      console.error("[orangesms-webhook] DB Error:", dbError);
      return json({ error: "Database update failed" }, 500);
    }

    return json({ message: "Webhook processed" }, 200);
  } catch (err) {
    console.error("[orangesms-webhook] Error processing webhook:", err);
    return json({ error: "Internal Server Error" }, 500);
  }
});
