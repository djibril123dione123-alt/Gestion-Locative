import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const CloseAgencySchema = z.object({
  agencyId: z.string().uuid(),
  reason: z.string().trim().min(12).max(500),
  idempotencyKey: z.string().trim().min(12).max(160),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

async function withRetry<T>(
  operation: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 300));
      }
    }
  }
  throw lastError;
}

async function listFilesRecursively(
  client: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const files: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await withRetry(async () => {
      const result = await client.storage.from(bucket).list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (result.error) throw result.error;
      return result;
    });
    if (error) throw error;
    if (!data?.length) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) files.push(path);
      else files.push(...await listFilesRecursively(client, bucket, path));
    }

    if (data.length < 100) break;
    offset += data.length;
  }

  return files;
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
    const rawBody = await req.json().catch(() => null);
    const parsed = CloseAgencySchema.safeParse(rawBody);
    if (!parsed.success) {
      return json({
        error: "La demande de cloture est incomplete ou invalide.",
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
      .select("role, actif")
      .eq("id", user.id)
      .single();
    if (profileError || profile?.role !== "super_admin" || profile.actif === false) {
      return json({ error: "Action reservee au super-administrateur.", code: "FORBIDDEN" }, 403);
    }

    const { agencyId, reason, idempotencyKey } = parsed.data;
    const { data: closure, error: closureError } = await userClient.rpc(
      "admin_delete_agency",
      {
        p_agency_id: agencyId,
        p_reason: reason,
        p_idempotency_key: idempotencyKey,
      },
    );
    if (closureError) {
      console.error("[close-agency-account] database closure failed", closureError.message);
      return json({ error: "La cloture n'a pas pu etre appliquee.", code: "CLOSURE_FAILED" }, 422);
    }

    const reportId = String(closure.closure_report_id);
    const revokedUserIds = Array.isArray(closure.revoked_user_ids)
      ? closure.revoked_user_ids.map(String)
      : [];
    const authResults: Array<{ userId: string; status: string; error?: string }> = [];
    let cleanupComplete = true;

    for (const userId of revokedUserIds) {
      try {
        await withRetry(async () => {
          const { error } = await serviceClient.auth.admin.updateUserById(userId, {
            ban_duration: "876000h",
          });
          if (error) throw error;
        });
        authResults.push({ userId, status: "banned" });
      } catch (error) {
        cleanupComplete = false;
        authResults.push({
          userId,
          status: "failed",
          error: error instanceof Error ? error.message : "Auth cleanup failed",
        });
      }
    }

    const storageResult: { bucket: string; removed: string[]; error?: string } = {
      bucket: "agency-assets",
      removed: [],
    };
    try {
      const identityFiles = await listFilesRecursively(
        serviceClient,
        "agency-assets",
        agencyId,
      );
      if (identityFiles.length > 0) {
        for (let index = 0; index < identityFiles.length; index += 100) {
          const chunk = identityFiles.slice(index, index + 100);
          await withRetry(async () => {
            const { error } = await serviceClient.storage
              .from("agency-assets")
              .remove(chunk);
            if (error) throw error;
          });
          storageResult.removed.push(...chunk);
        }
      }
    } catch (storageError) {
      cleanupComplete = false;
      storageResult.error = storageError instanceof Error
        ? storageError.message
        : "Identity asset cleanup failed";
    }

    let finalized: unknown = null;
    try {
      finalized = await withRetry(async () => {
        const { data, error } = await serviceClient.rpc(
          "admin_finalize_agency_closure",
          {
            p_report_id: reportId,
            p_auth_cleanup: { users: authResults },
            p_storage_cleanup: storageResult,
            p_completed: cleanupComplete,
          },
        );
        if (error) throw error;
        return data;
      });
    } catch (finalizeError) {
      console.error(
        "[close-agency-account] report finalization failed",
        finalizeError instanceof Error ? finalizeError.message : finalizeError,
      );
      return json({
        data: closure,
        warning: "Les acces sont fermes, mais la finalisation doit etre reprise.",
        code: "REPORT_FINALIZATION_FAILED",
        cleanupComplete: false,
        retryable: true,
        retryAfterSeconds: 30,
      }, 202);
    }

    const responseBody = {
      data: {
        ...closure,
        finalization: finalized,
        authCleanup: authResults,
        storageCleanup: storageResult,
      },
      cleanupComplete,
      retryable: !cleanupComplete,
      retryAfterSeconds: cleanupComplete ? null : 30,
    };
    return json(responseBody, cleanupComplete ? 200 : 202);
  } catch (error) {
    console.error("[close-agency-account] unexpected error", error);
    return json({ error: "Erreur inattendue pendant la cloture.", code: "INTERNAL_ERROR" }, 500);
  }
});
