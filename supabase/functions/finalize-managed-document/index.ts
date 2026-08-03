import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const FinalizeSchema = z.object({
  registryId: z.string().uuid(),
  storagePath: z.string().trim().min(12).max(1024),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

async function sha256Hex(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return json({ error: "Methode non autorisee.", code: "METHOD_NOT_ALLOWED" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Authentification requise.", code: "NOT_AUTHENTICATED" }, 401);
  }

  try {
    const parsed = FinalizeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return json({
        error: "La finalisation documentaire est incomplete.",
        code: "VALIDATION_ERROR",
      }, 422);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return json({ error: "Session invalide.", code: "INVALID_SESSION" }, 401);
    }

    const { data: profile, error: profileError } = await serviceClient
      .from("user_profiles")
      .select("agency_id, actif")
      .eq("id", user.id)
      .single();
    if (profileError || !profile?.agency_id || profile.actif === false) {
      return json({ error: "Acces documentaire refuse.", code: "FORBIDDEN" }, 403);
    }

    const { registryId, storagePath } = parsed.data;
    const expectedPrefix = `agencies/${profile.agency_id}/`;
    if (!storagePath.startsWith(expectedPrefix)) {
      return json({ error: "Chemin documentaire invalide.", code: "INVALID_PATH" }, 403);
    }

    const { data: storedFile, error: downloadError } = await serviceClient.storage
      .from("documents")
      .download(storagePath);
    if (downloadError || !storedFile) {
      return json({
        error: "Le fichier documentaire est introuvable.",
        code: "DOCUMENT_NOT_FOUND",
      }, 404);
    }

    const authoritativeHash = await sha256Hex(storedFile);
    const { data: entry, error: finalizeError } = await serviceClient.rpc(
      "fn_finalize_managed_document_server",
      {
        p_registry_id: registryId,
        p_storage_path: storagePath,
        p_file_hash: authoritativeHash,
        p_actor_id: user.id,
        p_agency_id: profile.agency_id,
      },
    );
    if (finalizeError) {
      console.error("[finalize-managed-document] finalization failed", finalizeError.message);
      return json({
        error: "Le document n'a pas pu etre finalise.",
        code: "FINALIZATION_FAILED",
      }, 422);
    }

    return json({ data: entry });
  } catch (error) {
    console.error("[finalize-managed-document] unexpected error", error);
    return json({
      error: "Erreur inattendue pendant la finalisation.",
      code: "INTERNAL_ERROR",
    }, 500);
  }
});
