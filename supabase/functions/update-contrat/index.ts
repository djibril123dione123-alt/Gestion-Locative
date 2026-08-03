import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  CONTRACT_CORS,
  contractError,
  contractJson,
  contractRpcFailure,
  resolveContractCommandContext,
} from "../_shared/contract-context.ts";

const UpdateContratSchema = z.object({
  id: z.string().uuid(),
  statut: z.enum(["actif", "expire", "resilie", "archive"]).optional(),
  date_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  commission: z.coerce.number().min(0).max(100).nullable().optional(),
  caution: z.coerce.number().min(0).nullable().optional(),
  resiliation_motif: z.string().trim().min(3).max(240).nullable().optional(),
  resiliation_observations: z.string().trim().max(1000).nullable().optional(),
});

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CONTRACT_CORS });
  if (req.method !== "PATCH" && req.method !== "POST") {
    return contractError("Méthode non autorisée.", 405, "METHOD_NOT_ALLOWED");
  }

  try {
    const context = await resolveContractCommandContext(req, "update");
    if (context instanceof Response) return context;

    const raw = await req.json().catch(() => null);
    const parsed = UpdateContratSchema.safeParse(raw);
    if (!parsed.success) {
      return contractError(
        "Les modifications du bail sont invalides.",
        422,
        "VALIDATION_ERROR",
        parsed.error.flatten(),
      );
    }
    if (parsed.data.statut === "resilie" && !parsed.data.date_fin) {
      return contractError("La date de résiliation est obligatoire.", 422, "RESILIATION_DATE_REQUIRED");
    }

    const { id, ...patch } = parsed.data;
    const { data, error } = await context.admin.rpc("fn_update_contrat_command", {
      p_agency_id: context.agencyId,
      p_user_id: context.userId,
      p_id: id,
      p_patch: patch,
    });

    if (error) return contractRpcFailure(error);
    return contractJson({ data });
  } catch (error) {
    console.error("[update-contrat] unexpected failure", error);
    return contractError("Erreur serveur inattendue.", 500, "INTERNAL_ERROR");
  }
});
