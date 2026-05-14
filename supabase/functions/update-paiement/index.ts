/**
 * update-paiement
 *
 * Financially safe payment edits. Confirmed cash payments are immutable in
 * amount: cancel and recreate to correct money. Pending payments may be turned
 * into cash; Postgres then writes the ledger transition exactly once.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const ModesPaiement = [
  "especes",
  "virement",
  "cheque",
  "mobile_money",
  "autre",
] as const;

const StatutsPaiement = ["paye", "partiel", "en_attente"] as const;

const UpdatePaiementSchema = z.object({
  id: z.string().uuid({ message: "id doit etre un UUID valide" }),
  montant_total: z.coerce
    .number({ invalid_type_error: "montant_total doit etre un nombre" })
    .positive({ message: "montant_total doit etre positif" })
    .optional(),
  mode_paiement: z.enum(ModesPaiement).optional(),
  statut: z.enum(StatutsPaiement).optional(),
  date_paiement: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "format YYYY-MM-DD attendu",
  }).optional(),
  reference: z.string().max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

type UpdatePaiementInput = z.infer<typeof UpdatePaiementSchema>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function err(message: string, status = 400, code?: string) {
  return json({ error: message, ...(code ? { code } : {}) }, status);
}

async function readBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function mapDbError(message: string): { message: string; status: number; code: string } {
  if (message.includes("LEDGER_IMMUTABLE")) {
    return {
      message: "Ce paiement est deja comptabilise. Annulez-le puis creez un paiement corrige.",
      status: 409,
      code: "LEDGER_IMMUTABLE",
    };
  }
  if (message.includes("OVERPAYMENT")) {
    return {
      message: message.replace(/^.*OVERPAYMENT:\s*/i, "Surpaiement detecte : "),
      status: 409,
      code: "OVERPAYMENT",
    };
  }
  if (message.includes("USE_CANCEL_PAYMENT")) {
    return {
      message: "Utilisez l'annulation de paiement pour generer l'ecriture de reversal.",
      status: 422,
      code: "USE_CANCEL_PAYMENT",
    };
  }
  if (message.includes("IMPAYE_IS_NOT_A_PAYMENT")) {
    return {
      message: "Un impaye est un solde a recouvrer, pas un paiement.",
      status: 422,
      code: "IMPAYE_IS_NOT_A_PAYMENT",
    };
  }
  if (message.includes("PAYMENT_NOT_FOUND")) {
    return { message: "Paiement introuvable ou acces refuse.", status: 404, code: "NOT_FOUND" };
  }
  if (message.includes("ALREADY_CANCELLED")) {
    return { message: "Impossible de modifier un paiement annule.", status: 422, code: "ALREADY_CANCELLED" };
  }
  if (message.includes("COMMISSION_REQUIRED")) {
    return {
      message: "Commission non definie sur ce contrat. Impossible de recalculer les parts.",
      status: 422,
      code: "COMMISSION_REQUIRED",
    };
  }
  return { message, status: 422, code: "DB_ERROR" };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "PATCH" && req.method !== "POST") {
    return err("Methode non autorisee. Utilisez PATCH ou POST.", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return err("Token d'authentification manquant.", 401, "NOT_AUTHENTICATED");
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authErr,
    } = await supabaseUser.auth.getUser();
    if (authErr || !user) return err("Token invalide ou expire.", 401, "INVALID_TOKEN");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("user_profiles")
      .select("agency_id, role, actif")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) return err("Profil utilisateur introuvable.", 403, "PROFILE_NOT_FOUND");
    if (!profile.actif) return err("Compte desactive.", 403, "ACCOUNT_DISABLED");
    if (profile.role === "bailleur") return err("Acces refuse.", 403, "FORBIDDEN_ROLE");
    if (!profile.agency_id) return err("Aucune agence associee.", 403, "NO_AGENCY");

    const rawBody = await readBody(req);
    if (!rawBody) return err("Corps invalide. JSON attendu.", 400, "INVALID_JSON");

    const parsed = UpdatePaiementSchema.safeParse(rawBody);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      return err(`Donnees invalides : ${details}`, 422, "VALIDATION_ERROR");
    }

    const input: UpdatePaiementInput = parsed.data;

    const { data: updated, error: rpcErr } = await supabaseAdmin.rpc(
      "fn_update_paiement_financial",
      {
        p_agency_id: profile.agency_id,
        p_user_id: user.id,
        p_id: input.id,
        p_montant_total: input.montant_total ?? null,
        p_mode_paiement: input.mode_paiement ?? null,
        p_statut: input.statut ?? null,
        p_date_paiement: input.date_paiement ?? null,
        p_reference: input.reference ?? null,
        p_notes: input.notes ?? null,
      },
    );

    if (rpcErr) {
      const mapped = mapDbError(rpcErr.message);
      return err(mapped.message, mapped.status, mapped.code);
    }

    await supabaseAdmin
      .from("event_log")
      .insert({
        agency_id: profile.agency_id,
        event_type: "paiement.updated",
        entity_type: "paiements",
        entity_id: input.id,
        payload: {
          fields_changed: Object.keys(input).filter((key) => key !== "id"),
          updated_by: user.id,
        },
        created_by: user.id,
      })
      .then(({ error }) => {
        if (error) console.warn("[update-paiement] event_log insert failed", error.message);
      });

    return json({ data: updated }, 200);
  } catch (unexpected) {
    console.error("[update-paiement] unexpected error", unexpected);
    return err("Erreur serveur inattendue.", 500, "INTERNAL_ERROR");
  }
});
