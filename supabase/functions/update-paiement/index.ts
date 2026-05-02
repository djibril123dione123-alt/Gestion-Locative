/**
 * Edge Function : update-paiement
 *
 * Garanties :
 *   1. JWT + agency_id injecté côté serveur
 *   2. Payload validé avec Zod
 *   3. Propriété du paiement vérifiée (agency_id)
 *   4. Si montant_total fourni → recalcul parts commission (source de vérité serveur)
 *   5. Paiement 'annule' non modifiable
 *   6. Log event_log après mutation
 *
 * Appelé via : supabase.functions.invoke('update-paiement', { body })
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

const StatutsPaiement = ["paye", "partiel", "impaye", "annule"] as const;

const UpdatePaiementSchema = z.object({
  id: z.string().uuid({ message: "id doit être un UUID valide" }),
  montant_total: z
    .number({ invalid_type_error: "montant_total doit être un nombre" })
    .positive({ message: "montant_total doit être positif" })
    .optional(),
  mode_paiement: z.enum(ModesPaiement).optional(),
  statut: z.enum(StatutsPaiement).optional(),
  date_paiement: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "format YYYY-MM-DD attendu" })
    .optional(),
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
function calculateParts(montant: number, commission: number) {
  const partAgence = Math.round((montant * commission) / 100);
  return { partAgence, partBailleur: montant - partAgence };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "PATCH" && req.method !== "POST") {
    return err("Méthode non autorisée — utilisez PATCH ou POST.", 405);
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

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return err("Token invalide ou expiré.", 401, "INVALID_TOKEN");
    }

    // ── 2. Profil + agency_id serveur ────────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("agency_id, role, actif")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return err("Profil utilisateur introuvable.", 403, "PROFILE_NOT_FOUND");
    }
    if (!profile.actif) return err("Compte désactivé.", 403, "ACCOUNT_DISABLED");
    if (profile.role === "bailleur") {
      return err("Accès refusé.", 403, "FORBIDDEN_ROLE");
    }

    const agencyId: string = profile.agency_id;
    if (!agencyId) return err("Aucune agence associée.", 403, "NO_AGENCY");

    // ── 3. Validation Zod ────────────────────────────────────────────────────
    let rawBody: unknown;
    try { rawBody = await req.json(); } catch {
      return err("Corps invalide — JSON attendu.", 400, "INVALID_JSON");
    }

    const parsed = UpdatePaiementSchema.safeParse(rawBody);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return err(`Données invalides — ${details}`, 422, "VALIDATION_ERROR");
    }

    const input: UpdatePaiementInput = parsed.data;

    // ── 4. Vérification propriété du paiement ────────────────────────────────
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("paiements")
      .select("id, statut, agency_id, contrat_id, montant_total")
      .eq("id", input.id)
      .eq("agency_id", agencyId)
      .single();

    if (fetchErr || !existing) {
      return err("Paiement introuvable ou accès refusé.", 404, "NOT_FOUND");
    }
    if (existing.statut === "annule") {
      return err("Impossible de modifier un paiement annulé.", 422, "ALREADY_CANCELLED");
    }

    // ── 4b. State machine — validation transition ─────────────────────────────
    const PAIEMENT_TRANSITIONS: Record<string, string[]> = {
      impaye:  ["paye", "partiel", "annule"],
      partiel: ["paye", "annule"],
      paye:    ["annule"],
      annule:  [],
    };

    if (input.statut && input.statut !== existing.statut) {
      const allowed = PAIEMENT_TRANSITIONS[existing.statut as string] ?? [];
      if (!allowed.includes(input.statut)) {
        return err(
          `Transition invalide : "${existing.statut}" → "${input.statut}". Autorisées depuis "${existing.statut}" : ${allowed.join(", ") || "aucune"}.`,
          422,
          "INVALID_TRANSITION",
        );
      }
    }

    // ── 5. Construction du patch ─────────────────────────────────────────────
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (input.mode_paiement !== undefined) patch.mode_paiement = input.mode_paiement;
    if (input.statut !== undefined) patch.statut = input.statut;
    if (input.date_paiement !== undefined) patch.date_paiement = input.date_paiement;
    if (input.reference !== undefined) patch.reference = input.reference;
    if (input.notes !== undefined) patch.notes = input.notes;

    // ── 5a. Recalcul parts si montant_total modifié ──────────────────────────
    if (input.montant_total !== undefined) {
      const { data: contrat, error: contratErr } = await supabaseAdmin
        .from("contrats")
        .select("commission")
        .eq("id", existing.contrat_id)
        .eq("agency_id", agencyId)
        .single();

      if (contratErr || !contrat) {
        return err("Contrat du paiement introuvable.", 404, "CONTRAT_NOT_FOUND");
      }
      if (contrat.commission === null || contrat.commission === undefined) {
        return err(
          "Commission non définie sur ce contrat. Impossible de recalculer les parts.",
          422,
          "COMMISSION_REQUIRED",
        );
      }

      const { partAgence, partBailleur } = calculateParts(
        input.montant_total,
        Number(contrat.commission),
      );
      patch.montant_total = input.montant_total;
      patch.part_agence = partAgence;
      patch.part_bailleur = partBailleur;
    }

    // Vérifier qu'il y a au moins un champ utile à mettre à jour
    if (Object.keys(patch).length === 1) {
      return err("Aucun champ à mettre à jour.", 422, "NO_FIELDS");
    }

    // ── 6. UPDATE via service role ───────────────────────────────────────────
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("paiements")
      .update(patch)
      .eq("id", input.id)
      .eq("agency_id", agencyId)
      .select()
      .single();

    if (updateErr) {
      return err(updateErr.message, 422, updateErr.code ?? "DB_ERROR");
    }

    // ── 7. Log event ─────────────────────────────────────────────────────────
    await supabaseAdmin
      .from("event_log")
      .insert({
        agency_id: agencyId,
        event_type: "paiement.updated",
        entity_type: "paiements",
        entity_id: input.id,
        payload: { fields_changed: Object.keys(patch).filter((k) => k !== "updated_at"), updated_by: user.id },
        created_by: user.id,
      })
      .catch(() => {});

    return json({ data: updated }, 200);
  } catch (_err) {
    return err("Erreur serveur inattendue.", 500, "INTERNAL_ERROR");
  }
});
