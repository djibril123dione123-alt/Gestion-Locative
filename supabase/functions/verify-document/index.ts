import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

type VerificationRow = {
  document_ref: string;
  document_type: string;
  agency_name: string;
  issued_at: string | null;
  amount_xof: number | null;
  payment_status: string | null;
  document_status: "authentic" | "revoked" | "superseded";
  metadata?: { period?: string | null } | null;
  created_at: string | null;
};

type RegistryRow = {
  reference: string;
  document_type: string;
  agency_id: string;
  period: string | null;
  generated_at: string | null;
  status: string;
  metadata?: Record<string, unknown> | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function verificationResponse(data: VerificationRow) {
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
      period: typeof data.metadata?.period === "string" ? data.metadata.period : null,
      registered_at: data.created_at,
    },
  });
}

async function registryResponse(supabase: ReturnType<typeof createClient>, data: RegistryRow) {
  const { data: agency } = await supabase
    .from("agencies")
    .select("name")
    .eq("id", data.agency_id)
    .maybeSingle();

  return json({
    valid: data.status === "active",
    status: data.status === "active" ? "authentic" : "superseded",
    document: {
      reference: data.reference,
      type: data.document_type,
      agency: agency?.name ?? "Samay Këur",
      issued_at: data.generated_at,
      amount_xof: null,
      payment_status: null,
      period: data.period,
      registered_at: data.generated_at,
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return json({ valid: false, error: "Méthode non autorisée" }, 405);

  const url = new URL(req.url);
  const token = (url.searchParams.get("token") ?? "").trim();
  const reference = (url.searchParams.get("ref") ?? url.searchParams.get("reference") ?? "").trim();
  const type = (url.searchParams.get("type") ?? "").trim();

  if (token && !/^[a-f0-9]{64}$/i.test(token)) {
    return json({ valid: false, error: "Jeton de vérification invalide" }, 400);
  }
  if (!token && !reference) {
    return json({ valid: false, error: "Jeton ou référence manquant" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ valid: false, error: "Service de vérification indisponible" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  if (token) {
    const { data, error } = await supabase
      .from("document_verifications")
      .select("document_ref, document_type, agency_name, issued_at, amount_xof, payment_status, document_status, metadata, created_at")
      .eq("token", token)
      .maybeSingle();

    if (error) {
      console.error("[verify-document]", error.message);
      return json({ valid: false, error: "Erreur de vérification" }, 500);
    }

    if (data) return verificationResponse(data as VerificationRow);
  }

  if (reference) {
    let verificationQuery = supabase
      .from("document_verifications")
      .select("document_ref, document_type, agency_name, issued_at, amount_xof, payment_status, document_status, metadata, created_at")
      .eq("document_ref", reference)
      .order("created_at", { ascending: false })
      .limit(1);

    if (type) verificationQuery = verificationQuery.eq("document_type", type);

    const { data: verificationData, error: verificationError } = await verificationQuery.maybeSingle();
    if (verificationError) {
      console.error("[verify-document:reference]", verificationError.message);
      return json({ valid: false, error: "Erreur de vérification" }, 500);
    }
    if (verificationData) return verificationResponse(verificationData as VerificationRow);

    let registryQuery = supabase
      .from("document_registry")
      .select("reference, document_type, agency_id, period, generated_at, status, metadata")
      .eq("reference", reference)
      .neq("status", "deleted")
      .order("generated_at", { ascending: false })
      .limit(1);

    if (type) registryQuery = registryQuery.eq("document_type", type);

    const { data: registryData, error: registryError } = await registryQuery.maybeSingle();
    if (registryError) {
      console.error("[verify-document:registry]", registryError.message);
      return json({ valid: false, error: "Erreur de vérification" }, 500);
    }
    if (registryData) return registryResponse(supabase, registryData as RegistryRow);
  }

  return json({ valid: false, error: "Document introuvable ou invalide" }, 404);
});
