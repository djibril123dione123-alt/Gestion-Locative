import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const BUCKET = "agency-assets";
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ASSET_CONFIG = {
  logo: { field: "logo_url", folder: "logos" },
  signature: { field: "signature_url", folder: "signatures" },
  stamp: { field: "stamp_url", folder: "stamps" },
} as const;

type AssetKind = keyof typeof ASSET_CONFIG;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function parseAssetKind(value: unknown): AssetKind | null {
  return typeof value === "string" && value in ASSET_CONFIG ? value as AssetKind : null;
}

function detectImageType(bytes: Uint8Array): { mime: string; extension: string } | null {
  if (
    bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return { mime: "image/png", extension: "png" };

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }

  if (
    bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  ) return { mime: "image/webp", extension: "webp" };

  return null;
}

function extractOwnedPath(value: unknown, agencyId: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const decoded = decodeURIComponent(value.split("?")[0]);
  const markers = [
    `/storage/v1/object/public/${BUCKET}/`,
    `/storage/v1/object/sign/${BUCKET}/`,
    `/storage/v1/object/${BUCKET}/`,
  ];
  const marker = markers.find((candidate) => decoded.includes(candidate));
  const path = marker ? decoded.slice(decoded.indexOf(marker) + marker.length) : decoded;
  return path.startsWith(`${agencyId}/`) ? path : null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST" && req.method !== "DELETE") {
    return json({ error: "Methode non autorisee.", code: "METHOD_NOT_ALLOWED" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Authentification requise.", code: "NOT_AUTHENTICATED" }, 401);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Session invalide.", code: "INVALID_SESSION" }, 401);

    let agencyId: string | null = null;
    let kind: AssetKind | null = null;
    let file: File | null = null;

    if (req.method === "POST") {
      const form = await req.formData();
      agencyId = typeof form.get("agencyId") === "string" ? String(form.get("agencyId")) : null;
      kind = parseAssetKind(form.get("kind"));
      const candidate = form.get("file");
      file = candidate instanceof File ? candidate : null;
    } else {
      const body = await req.json().catch(() => null) as { agencyId?: unknown; kind?: unknown } | null;
      agencyId = typeof body?.agencyId === "string" ? body.agencyId : null;
      kind = parseAssetKind(body?.kind);
    }

    if (!agencyId || !kind || (req.method === "POST" && !file)) {
      return json({ error: "La demande de fichier est incomplete.", code: "VALIDATION_ERROR" }, 422);
    }

    const { data: profile, error: profileError } = await serviceClient
      .from("user_profiles")
      .select("agency_id, role, actif")
      .eq("id", user.id)
      .single();
    const allowedRole = profile?.role === "admin" || profile?.role === "bailleur";
    if (profileError || profile?.actif === false || profile?.agency_id !== agencyId || !allowedRole) {
      return json({ error: "Vous ne pouvez pas modifier cette identite documentaire.", code: "FORBIDDEN" }, 403);
    }

    const config = ASSET_CONFIG[kind];
    const { data: currentSettings, error: settingsError } = await serviceClient
      .from("agency_settings")
      .select("*")
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (settingsError) throw settingsError;

    const previousPath = extractOwnedPath(currentSettings?.[config.field], agencyId);

    if (req.method === "DELETE") {
      const update: Record<string, unknown> = { [config.field]: null };
      if (kind === "stamp") update.stamp_enabled = false;
      if (kind === "signature") update.signature_enabled = false;
      const { data: savedSettings, error: updateError } = await serviceClient
        .from("agency_settings")
        .upsert({ agency_id: agencyId, ...update }, { onConflict: "agency_id" })
        .select("*")
        .single();
      if (updateError) throw updateError;
      if (previousPath) {
        const { error: removeError } = await serviceClient.storage.from(BUCKET).remove([previousPath]);
        if (removeError) console.error("[identity-asset] old asset cleanup failed", removeError.message);
      }
      return json({ data: { path: null, signedUrl: null, settings: savedSettings } });
    }

    if (!file || file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return json({ error: "Le fichier doit peser moins de 2 Mo.", code: "FILE_TOO_LARGE" }, 422);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectImageType(bytes);
    if (!detected) {
      return json({
        error: "Format refuse. Utilisez une image PNG, JPEG ou WebP valide.",
        code: "UNSUPPORTED_IMAGE",
      }, 422);
    }

    const path = `${agencyId}/${config.folder}/${kind}-${crypto.randomUUID()}.${detected.extension}`;
    const { error: uploadError } = await serviceClient.storage.from(BUCKET).upload(path, bytes, {
      cacheControl: "3600",
      contentType: detected.mime,
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const update: Record<string, unknown> = { [config.field]: path };
    if (kind === "stamp") update.stamp_enabled = true;
    if (kind === "signature") update.signature_enabled = true;
    const { data: savedSettings, error: updateError } = await serviceClient
      .from("agency_settings")
      .upsert({ agency_id: agencyId, ...update }, { onConflict: "agency_id" })
      .select("*")
      .single();
    if (updateError) {
      await serviceClient.storage.from(BUCKET).remove([path]);
      throw updateError;
    }

    if (previousPath && previousPath !== path) {
      const { error: removeError } = await serviceClient.storage.from(BUCKET).remove([previousPath]);
      if (removeError) console.error("[identity-asset] old asset cleanup failed", removeError.message);
    }

    const { data: signed, error: signedError } = await serviceClient.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (signedError) throw signedError;
    return json({ data: { path, signedUrl: signed.signedUrl, settings: savedSettings } });
  } catch (error) {
    console.error("[identity-asset] unexpected error", error);
    return json({ error: "Le fichier n'a pas pu etre enregistre.", code: "INTERNAL_ERROR" }, 500);
  }
});
