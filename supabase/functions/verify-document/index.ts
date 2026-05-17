import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return json({ valid: false, error: "Méthode non autorisée" }, 405);

  const url = new URL(req.url);
  const token = (url.searchParams.get("token") ?? "").trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return json({ valid: false, error: "Jeton de vérification invalide" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ valid: false, error: "Service de vérification indisponible" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("document_verifications")
    .select("document_ref, document_type, agency_name, issued_at, amount_xof, payment_status, document_status, created_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("[verify-document]", error.message);
    return json({ valid: false, error: "Erreur de vérification" }, 500);
  }

  if (!data) {
    return json({ valid: false, error: "Document introuvable ou invalide" }, 404);
  }

  const authentic = data.document_status === "authentic";
  return json({
    valid: authentic,
    status: data.document_status,
    document: {
      reference: data.document_ref,
      type: data.document_type,
      agency: data.agency_name,
      issued_at: data.issued_at,
      amount_xof: data.amount_xof,
      payment_status: data.payment_status,
      registered_at: data.created_at,
    },
  });
});
