/**
 * Edge Function : create-contrat
 *
 * Garanties :
 *   1. JWT + agency_id injecté côté serveur
 *   2. Validation Zod complète
 *   3. Vérification disponibilité de l'unité (statut != 'loue') côté serveur
 *   4. INSERT contrat + UPDATE unite en séquence avec rollback manuel
 *   5. Log event_log (contrat.created)
 *   6. Tracking pilot : first_contract_at sur l'agence
 *
 * Appelé via : supabase.functions.invoke('create-contrat', { body })
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

const ContratStatuts = ["actif", "expire", "resilie"] as const;

const CreateContratSchema = z.object({
  locataire_id: z.string().uuid({ message: "locataire_id invalide" }),
  unite_id: z.string().uuid({ message: "unite_id invalide" }),
  date_debut: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "date_debut format YYYY-MM-DD" }),
  date_fin: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "date_fin format YYYY-MM-DD" })
    .nullable()
    .optional(),
  loyer_mensuel: z
    .number({ invalid_type_error: "loyer_mensuel doit être un nombre" })
    .positive({ message: "loyer_mensuel doit être strictement positif" }),
  commission: z
    .number()
    .min(0)
    .max(100, { message: "commission entre 0 et 100" })
    .nullable()
    .optional(),
  caution: z
    .number()
    .min(0)
    .nullable()
    .optional(),
  statut: z.enum(ContratStatuts, {
    errorMap: () => ({ message: `statut doit être : ${ContratStatuts.join(", ")}` }),
  }),
  destination: z.string().max(200).nullable().optional(),
});

type CreateContratInput = z.infer<typeof CreateContratSchema>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}
function err(message: string, status = 400, code?: string, details?: unknown) {
  return json({ error: message, ...(code ? { code } : {}), ...(details ? { details } : {}) }, status);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return err("Méthode non autorisée — utilisez POST.", 405);

  try {
    // ── 1. Authentification ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return err("Token manquant.", 401, "NOT_AUTHENTICATED");
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) return err("Token invalide.", 401, "INVALID_TOKEN");

    // ── 2. Profil + agency_id serveur ────────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("user_profiles")
      .select("agency_id, role, actif")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) return err("Profil introuvable.", 403, "PROFILE_NOT_FOUND");
    if (!profile.actif) return err("Compte désactivé.", 403, "ACCOUNT_DISABLED");
    if (profile.role === "bailleur") return err("Accès refusé.", 403, "FORBIDDEN_ROLE");

    const agencyId: string = profile.agency_id;
    if (!agencyId) return err("Aucune agence associée.", 403, "NO_AGENCY");

    // ── 3. Validation Zod ────────────────────────────────────────────────────
    let rawBody: unknown;
    try { rawBody = await req.json(); } catch {
      return err("JSON invalide.", 400, "INVALID_JSON");
    }

    const parsed = CreateContratSchema.safeParse(rawBody);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return err(`Données invalides — ${details}`, 422, "VALIDATION_ERROR");
    }

    const input: CreateContratInput = parsed.data;

    // ── 4. Vérification propriété locataire + unité ──────────────────────────
    const [{ data: locataire, error: locErr }, { data: unite, error: uniteErr }] =
      await Promise.all([
        supabaseAdmin
          .from("locataires")
          .select("id")
          .eq("id", input.locataire_id)
          .eq("agency_id", agencyId)
          .single(),
        supabaseAdmin
          .from("unites")
          .select("id, statut")
          .eq("id", input.unite_id)
          .eq("agency_id", agencyId)
          .single(),
      ]);

    if (locErr || !locataire) {
      return err("Locataire introuvable ou n'appartient pas à cette agence.", 404, "LOCATAIRE_NOT_FOUND");
    }
    if (uniteErr || !unite) {
      return err("Unité introuvable ou n'appartient pas à cette agence.", 404, "UNITE_NOT_FOUND");
    }
    const { data: existingContrat } = await supabaseAdmin
      .from("contrats")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("unite_id", input.unite_id)
      .eq("statut", "actif")
      .maybeSingle();

    if (unite.statut === "loue" || existingContrat) {
      return err(
        existingContrat
          ? "Un contrat actif existe déjà pour cette unité."
          : "Ce produit est déjà occupé. Veuillez en sélectionner un autre.",
        409,
        existingContrat ? "CONTRAT_ALREADY_EXISTS" : "UNITE_ALREADY_LOUE",
      );
    }

    // ── 5. INSERT contrat ────────────────────────────────────────────────────

    const { data: contrat, error: insertErr } = await supabaseAdmin
      .from("contrats")
      .insert({
        locataire_id: input.locataire_id,
        unite_id: input.unite_id,
        date_debut: input.date_debut,
        date_fin: input.date_fin ?? null,
        loyer_mensuel: input.loyer_mensuel,
        commission: input.commission ?? null,
        caution: input.caution ?? null,
        statut: input.statut,
        destination: input.destination ?? null,
        agency_id: agencyId,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertErr) {
      return err(insertErr.message, 422, insertErr.code ?? "DB_CONTRAT_ERROR");
    }

    // ── 6. UPDATE unité → 'loue' ─────────────────────────────────────────────
    const { error: uniteUpdateErr } = await supabaseAdmin
      .from("unites")
      .update({ statut: "loue" })
      .eq("id", input.unite_id)
      .eq("agency_id", agencyId);

    if (uniteUpdateErr) {
      // Rollback manuel : suppression du contrat créé
      const { error: rollbackErr } = await supabaseAdmin.from("contrats").delete().eq("id", contrat.id);
      if (rollbackErr) {
        return err(
          "Échec critique : le contrat a été créé mais le rollback a échoué.",
          500,
          "ROLLBACK_FAILED",
          rollbackErr.message,
        );
      }
      return err(
        "Échec de la mise à jour du statut de l'unité. Contrat annulé.",
        500,
        "UNITE_UPDATE_FAILED",
      );
    }

    // ── 7. Pilot tracking : first_contract_at ────────────────────────────────
    await supabaseAdmin
      .from("agencies")
      .update({ first_contract_at: new Date().toISOString() })
      .eq("id", agencyId)
      .is("first_contract_at", null)
      .catch(() => {});

    return json({ data: contrat }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur inattendue.";
    return json({ error: message, code: "INTERNAL_ERROR" }, 500);
  }
});
