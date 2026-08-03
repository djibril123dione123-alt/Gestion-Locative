import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  CONTRACT_CORS,
  contractError,
  contractJson,
  contractRpcFailure,
  resolveContractCommandContext,
} from "../_shared/contract-context.ts";

const RenewContratSchema = z.object({
  id: z.string().uuid(),
  nouvelle_date_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nouveau_loyer: z.coerce.number().positive().nullable().optional(),
  remarques: z.string().trim().max(1000).nullable().optional(),
});

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CONTRACT_CORS });
  if (req.method !== "POST") return contractError("Méthode non autorisée.", 405, "METHOD_NOT_ALLOWED");

  try {
    const context = await resolveContractCommandContext(req, "update");
    if (context instanceof Response) return context;

    const raw = await req.json().catch(() => null);
    const parsed = RenewContratSchema.safeParse(raw);
    if (!parsed.success) {
      return contractError(
        "Les informations de renouvellement sont invalides.",
        422,
        "VALIDATION_ERROR",
        parsed.error.flatten(),
      );
    }

    const input = parsed.data;
    const { data, error } = await context.admin.rpc("fn_renew_contrat_command", {
      p_agency_id: context.agencyId,
      p_user_id: context.userId,
      p_id: input.id,
      p_nouvelle_date_fin: input.nouvelle_date_fin,
      p_nouveau_loyer: input.nouveau_loyer ?? null,
      p_remarques: input.remarques ?? null,
    });

    if (error) return contractRpcFailure(error);
    return contractJson({ data });
  } catch (error) {
    console.error("[renew-contrat] unexpected failure", error);
    return contractError("Erreur serveur inattendue.", 500, "INTERNAL_ERROR");
  }
});
