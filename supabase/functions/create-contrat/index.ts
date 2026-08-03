import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  CONTRACT_CORS,
  contractError,
  contractJson,
  contractRpcFailure,
  resolveContractCommandContext,
} from "../_shared/contract-context.ts";

const CreateContratSchema = z.object({
  locataire_id: z.string().uuid(),
  unite_id: z.string().uuid(),
  date_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  loyer_mensuel: z.coerce.number().positive(),
  commission: z.coerce.number().min(0).max(100).nullable().optional(),
  caution: z.coerce.number().min(0).nullable().optional(),
  statut: z.literal("actif"),
  destination: z.string().trim().max(200).nullable().optional(),
  is_demo_data: z.boolean().optional().default(false),
});

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CONTRACT_CORS });
  if (req.method !== "POST") return contractError("Méthode non autorisée.", 405, "METHOD_NOT_ALLOWED");

  try {
    const context = await resolveContractCommandContext(req, "create");
    if (context instanceof Response) return context;

    const raw = await req.json().catch(() => null);
    const parsed = CreateContratSchema.safeParse(raw);
    if (!parsed.success) {
      return contractError(
        "Les informations du bail sont incomplètes ou invalides.",
        422,
        "VALIDATION_ERROR",
        parsed.error.flatten(),
      );
    }

    const input = parsed.data;
    const { data, error } = await context.admin.rpc("fn_create_contrat_command", {
      p_agency_id: context.agencyId,
      p_user_id: context.userId,
      p_locataire_id: input.locataire_id,
      p_unite_id: input.unite_id,
      p_date_debut: input.date_debut,
      p_date_fin: input.date_fin ?? null,
      p_loyer_mensuel: input.loyer_mensuel,
      p_commission: input.commission ?? null,
      p_caution: input.caution ?? null,
      p_destination: input.destination ?? null,
      p_is_demo_data: input.is_demo_data,
    });

    if (error) return contractRpcFailure(error);
    return contractJson({ data }, 201);
  } catch (error) {
    console.error("[create-contrat] unexpected failure", error);
    return contractError("Erreur serveur inattendue.", 500, "INTERNAL_ERROR");
  }
});
