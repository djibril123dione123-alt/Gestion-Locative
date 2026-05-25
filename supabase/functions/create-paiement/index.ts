/**
 * create-paiement
 *
 * Server source of truth for rent payments. The actual financial mutation is
 * delegated to Postgres RPC so the overpayment check, partial-payment balance,
 * commission split and insert happen in one locked transaction.
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

const CreatePaiementSchema = z.object({
  contrat_id: z.string().uuid({ message: "contrat_id doit etre un UUID valide" }),
  montant_total: z.coerce
    .number({ invalid_type_error: "montant_total doit etre un nombre" })
    .positive({ message: "montant_total doit etre strictement positif" }),
  mois_concerne: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "mois_concerne doit etre au format YYYY-MM-DD",
  }),
  date_paiement: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "date_paiement doit etre au format YYYY-MM-DD",
  }),
  mode_paiement: z.enum(ModesPaiement, {
    errorMap: () => ({
      message: `mode_paiement doit etre : ${ModesPaiement.join(", ")}`,
    }),
  }),
  statut: z.enum(StatutsPaiement, {
    errorMap: () => ({
      message: "statut doit etre paye, partiel ou en_attente",
    }),
  }).default("paye"),
  idempotency_key: z.string().min(12).max(120).nullable().optional(),
  reference: z.string().max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

type CreatePaiementInput = z.infer<typeof CreatePaiementSchema>;

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
  if (message.includes("OVERPAYMENT")) {
    if (message.includes("total deja encaisse")) {
      return {
        message: "Ce mois est deja solde pour ce contrat. Modifiez le paiement existant ou choisissez une autre echeance.",
        status: 409,
        code: "PAYMENT_MONTH_ALREADY_SETTLED",
      };
    }
    return {
      message: message.replace(/^.*OVERPAYMENT:\s*/i, "Surpaiement detecte : "),
      status: 409,
      code: "OVERPAYMENT",
    };
  }
  if (message.includes("COMMISSION_REQUIRED")) {
    return {
      message: "La commission n'est pas definie sur ce contrat.",
      status: 422,
      code: "COMMISSION_REQUIRED",
    };
  }
  if (message.includes("COMMISSION_RANGE")) {
    return {
      message: "Le taux de commission doit etre entre 0 et 100.",
      status: 422,
      code: "COMMISSION_RANGE",
    };
  }
  if (message.includes("IMPAYE_IS_NOT_A_PAYMENT")) {
    return {
      message: "Un impaye est un solde a recouvrer, pas un paiement. Enregistrez un encaissement reel.",
      status: 422,
      code: "IMPAYE_IS_NOT_A_PAYMENT",
    };
  }
  if (message.includes("CONTRAT_NOT_FOUND")) {
    return {
      message: "Contrat introuvable ou acces refuse.",
      status: 404,
      code: "CONTRAT_NOT_FOUND",
    };
  }
  return { message, status: 422, code: "DB_ERROR" };
}

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: err("Token d'authentification manquant.", 401, "NOT_AUTHENTICATED") };
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

  if (authErr || !user) {
    return { error: err("Token invalide ou expire.", 401, "INVALID_TOKEN") };
  }

  return { user };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return err("Methode non autorisee. Utilisez POST.", 405);

  try {
    const auth = await getAuthenticatedUser(req);
    if (auth.error) return auth.error;
    const user = auth.user!;

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
    if (!profile.agency_id) return err("Aucune agence associee a ce compte.", 403, "NO_AGENCY");

    const { data: agency, error: agencyErr } = await supabaseAdmin
      .from("agencies")
      .select("is_bailleur_account")
      .eq("id", profile.agency_id)
      .single();
    if (agencyErr || !agency) return err("Espace introuvable.", 403, "AGENCY_NOT_FOUND");
    const isIndividualOwnerAccount = agency.is_bailleur_account === true;

    if (profile.role === "bailleur" && !isIndividualOwnerAccount) {
      return err("Acces refuse : les bailleurs ne peuvent pas creer de paiements.", 403, "FORBIDDEN_ROLE");
    }

    if (!(isIndividualOwnerAccount && profile.role === "bailleur")) {
      const { data: canCreatePaiement, error: permissionErr } = await supabaseAdmin.rpc(
        "fn_user_can",
        { p_user_id: user.id, p_page: "paiements", p_action: "create" },
      );
      if (permissionErr) {
        console.error("[create-paiement] RBAC check failed", permissionErr.message);
        return err("Verification des permissions indisponible.", 500, "RBAC_CHECK_FAILED");
      }
      if (!canCreatePaiement) {
        return err("Action refusee par les permissions de l'agence.", 403, "RBAC_FORBIDDEN");
      }
    }

    const rawBody = await readBody(req);
    if (!rawBody) return err("Corps de la requete invalide. JSON attendu.", 400, "INVALID_JSON");

    const parsed = CreatePaiementSchema.safeParse(rawBody);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      return err(`Donnees invalides : ${details}`, 422, "VALIDATION_ERROR");
    }

    const input: CreatePaiementInput = parsed.data;
    const idempotencyKey = input.idempotency_key?.trim() || null;

    const { data: paiement, error: rpcErr } = await supabaseAdmin.rpc(
      "fn_create_paiement_financial",
      {
        p_agency_id: profile.agency_id,
        p_user_id: user.id,
        p_contrat_id: input.contrat_id,
        p_montant_total: input.montant_total,
        p_mois_concerne: input.mois_concerne,
        p_date_paiement: input.date_paiement,
        p_mode_paiement: input.mode_paiement,
        p_statut: input.statut,
        p_reference: input.reference ?? null,
        p_notes: input.notes ?? null,
        p_idempotency_key: idempotencyKey,
      },
    );

    if (rpcErr) {
      if (rpcErr.code === "23505" && idempotencyKey) {
        const { data: existingPayment } = await supabaseAdmin
          .from("paiements")
          .select()
          .eq("agency_id", profile.agency_id)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();

        if (existingPayment) return json({ data: existingPayment, idempotent: true }, 200);
      }

      const mapped = mapDbError(rpcErr.message);
      return err(mapped.message, mapped.status, mapped.code);
    }

    return json({ data: paiement }, 201);
  } catch (unexpected) {
    console.error("[create-paiement] unexpected error", unexpected);
    return err("Erreur serveur inattendue.", 500, "INTERNAL_ERROR");
  }
});
