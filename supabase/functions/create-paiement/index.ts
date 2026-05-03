/**
 * Edge Function : create-paiement
 *
 * Source de vérité serveur pour la création de paiements.
 *
 * Garanties :
 *   1. JWT vérifié — utilisateur authentifié
 *   2. agency_id injecté côté serveur (jamais lu depuis le client)
 *   3. Payload validé avec Zod (types, bornes, formats)
 *   4. Propriété du contrat vérifiée via RLS (client JWT)
 *   5. Commission calculée serveur (identique à commissionService frontend)
 *   6. INSERT via service role avec agency_id injecté
 *
 * Appelé via : supabase.functions.invoke('create-paiement', { body })
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

// ─── Schéma Zod ───────────────────────────────────────────────────────────────

const ModesPaiement = [
  "especes",
  "virement",
  "cheque",
  "mobile_money",
  "carte",
] as const;

const StatutsPaiement = ["paye", "en_attente", "partiel"] as const;

const CreatePaiementSchema = z.object({
  contrat_id: z
    .string()
    .uuid({ message: "contrat_id doit être un UUID valide" }),
  montant_total: z.coerce
    .number({ invalid_type_error: "montant_total doit être un nombre" })
    .positive({ message: "montant_total doit être strictement positif" }),
  mois_concerne: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "mois_concerne doit être au format YYYY-MM-DD",
    }),
  date_paiement: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "date_paiement doit être au format YYYY-MM-DD",
    }),
  mode_paiement: z.enum(ModesPaiement, {
    errorMap: () => ({
      message: `mode_paiement doit être : ${ModesPaiement.join(", ")}`,
    }),
  }),
  statut: z.enum(StatutsPaiement, {
    errorMap: () => ({
      message: `statut doit être : ${StatutsPaiement.join(", ")}`,
    }),
  }),
  reference: z.string().max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

type CreatePaiementInput = z.infer<typeof CreatePaiementSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// Commission calculation — identique à commissionService.ts frontend
function calculateParts(
  montantTotal: number,
  commission: number,
): { partAgence: number; partBailleur: number } {
  const partAgence = Math.round((montantTotal * commission) / 100);
  const partBailleur = montantTotal - partAgence;
  return { partAgence, partBailleur };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return err("Méthode non autorisée — utilisez POST.", 405);
  }

  try {
    // ── 1. Authentification ──────────────────────────────────────────────────
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

    if (authErr || !user) {
      return err("Token invalide ou expiré.", 401, "INVALID_TOKEN");
    }

    // ── 2. Profil + agency_id injecté serveur ────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("user_profiles")
      .select("agency_id, role, actif")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return err("Profil utilisateur introuvable.", 403, "PROFILE_NOT_FOUND");
    }

    if (!profile.actif) {
      return err("Compte désactivé.", 403, "ACCOUNT_DISABLED");
    }

    if (profile.role === "bailleur") {
      return err(
        "Accès refusé : les bailleurs ne peuvent pas créer de paiements.",
        403,
        "FORBIDDEN_ROLE",
      );
    }

    const agencyId: string = profile.agency_id;
    if (!agencyId) {
      return err("Aucune agence associée à ce compte.", 403, "NO_AGENCY");
    }

    // ── 3. Validation Zod ────────────────────────────────────────────────────
    const rawBody = await readBody(req);
    if (!rawBody) {
      return err(
        "Corps de la requête invalide — JSON attendu.",
        400,
        "INVALID_JSON",
      );
    }

    const parsed = CreatePaiementSchema.safeParse(rawBody);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return err(`Données invalides — ${details}`, 422, "VALIDATION_ERROR");
    }

    const input: CreatePaiementInput = parsed.data;

    // ── 4. Vérification propriété du contrat (via RLS user client) ───────────
    // Le client JWT garantit que seuls les contrats de l'agence sont accessibles.
    const { data: contrat, error: contratErr } = await supabaseUser
      .from("contrats")
      .select("id, commission, loyer_mensuel, statut")
      .eq("id", input.contrat_id)
      .maybeSingle();

    if (contratErr || !contrat) {
      return err(
        "Contrat introuvable ou accès refusé.",
        404,
        "CONTRAT_NOT_FOUND",
      );
    }

    // ── 5. Validation commission (règle métier centrale) ────────────────────
    if (contrat.commission === null || contrat.commission === undefined) {
      return err(
        "COMMISSION_REQUISE : La commission n'est pas définie sur ce contrat. " +
          "Configurez le taux avant d'enregistrer un paiement.",
        422,
        "COMMISSION_REQUIRED",
      );
    }

    const commission = Number(contrat.commission);
    if (isNaN(commission) || commission < 0 || commission > 100) {
      return err(
        `COMMISSION_HORS_BORNES : Le taux (${contrat.commission}%) doit être entre 0 et 100.`,
        422,
        "COMMISSION_RANGE",
      );
    }

    // ── 6. Calcul parts (source de vérité serveur) ───────────────────────────
    const { partAgence, partBailleur } = calculateParts(
      input.montant_total,
      commission,
    );

    // Sanity check avant d'écrire en base
    const ecart = Math.abs(partAgence + partBailleur - input.montant_total);
    if (ecart >= 0.01) {
      return err(
        `Incohérence de calcul interne : parts (${partAgence} + ${partBailleur}) ≠ total (${input.montant_total}).`,
        500,
        "CALC_ERROR",
      );
    }

    // ── 7. INSERT via service role — agency_id injecté serveur ──────────────
    const { data: paiement, error: insertErr } = await supabaseAdmin
      .from("paiements")
      .insert({
        contrat_id: input.contrat_id,
        montant_total: input.montant_total,
        mois_concerne: input.mois_concerne,
        date_paiement: input.date_paiement,
        mode_paiement: input.mode_paiement,
        statut: input.statut,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        part_agence: partAgence,
        part_bailleur: partBailleur,
        agency_id: agencyId, // injecté serveur — jamais lu depuis le client
        created_by: user.id,
      })
      .select()
      .single();

    if (insertErr) {
      // Remonter les erreurs de triggers PL/pgSQL (messages métier en français)
      return err(
        insertErr.message,
        422,
        insertErr.code ?? "DB_CONSTRAINT",
      );
    }

    return json({ data: paiement }, 201);
  } catch (_err) {
    return err("Erreur serveur inattendue.", 500, "INTERNAL_ERROR");
  }
});
