import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers": "Retry-After",
  "Cache-Control": "no-store, max-age=0",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Content-Type": "application/json",
};

const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const MAX_REFERENCE_LENGTH = 160;
const MAX_TYPE_LENGTH = 64;
const RATE_LIMIT_REQUESTS = 60;
const RATE_LIMIT_WINDOW_SECONDS = 60;

type VerificationRow = {
  document_ref: string;
  document_type: string;
  agency_name: string;
  issued_at: string | null;
  document_status: "authentic" | "revoked" | "superseded";
};

function json(body: unknown, status = 200, extraHeaders?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, ...Object.fromEntries(new Headers(extraHeaders).entries()) },
  });
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
    },
  });
}

function documentTypeMatches(actual: string, asserted: string) {
  if (!asserted) return true;
  if (actual === asserted) return true;
  const reportAliases = new Set(["rapport", "rapport_bailleur"]);
  return reportAliases.has(actual) && reportAliases.has(asserted);
}

function getRequestAddress(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return req.headers.get("cf-connecting-ip")?.trim()
    || req.headers.get("x-real-ip")?.trim()
    || forwarded
    || "unknown";
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function consumeRateLimit(
  supabase: ReturnType<typeof createClient>,
  req: Request,
  secret: string,
) {
  const fingerprint = await sha256Hex(secret + "|" + getRequestAddress(req));
  const { data, error } = await supabase.rpc("consume_document_verification_rate_limit", {
    p_fingerprint: fingerprint,
    p_limit: RATE_LIMIT_REQUESTS,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  });

  if (error) {
    console.error("[verify-document:rate-limit]", error.message);
    return { available: false, allowed: false, retryAfter: RATE_LIMIT_WINDOW_SECONDS };
  }

  const result = Array.isArray(data) ? data[0] : data;
  return {
    available: true,
    allowed: result?.allowed === true,
    retryAfter: Math.max(1, Number(result?.retry_after_seconds) || 1),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return json({ valid: false, error: "Méthode non autorisée." }, 405);

  const url = new URL(req.url);
  const token = (url.searchParams.get("token") ?? "").trim();
  const reference = (url.searchParams.get("ref") ?? url.searchParams.get("reference") ?? "").trim();
  const type = (url.searchParams.get("type") ?? "").trim().toLowerCase();

  if (!TOKEN_PATTERN.test(token)) {
    return json({ valid: false, error: "Un jeton de vérification valide est requis." }, 400);
  }
  if (reference.length > MAX_REFERENCE_LENGTH || type.length > MAX_TYPE_LENGTH) {
    return json({ valid: false, error: "Lien de vérification invalide." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ valid: false, error: "Service de vérification indisponible." }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const rateLimit = await consumeRateLimit(supabase, req, serviceRoleKey);
  if (!rateLimit.available) {
    return json({ valid: false, error: "Service de vérification temporairement indisponible." }, 503);
  }
  if (!rateLimit.allowed) {
    return json(
      { valid: false, error: "Trop de tentatives. Réessayez dans quelques instants." },
      429,
      { "Retry-After": String(rateLimit.retryAfter) },
    );
  }

  const { data, error } = await supabase
    .from("document_verifications")
    .select("document_ref, document_type, agency_name, issued_at, document_status")
    .eq("token", token.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error("[verify-document]", error.message);
    return json({ valid: false, error: "Erreur de vérification." }, 500);
  }

  const row = data as VerificationRow | null;
  const referenceMatches = !reference || row?.document_ref === reference;
  const typeMatches = !row || documentTypeMatches(row.document_type.toLowerCase(), type);
  if (!row || !referenceMatches || !typeMatches) {
    return json({ valid: false, error: "Document introuvable ou invalide." }, 404);
  }

  return verificationResponse(row);
});
