/**
 * Edge Function : cancel-paiement
 *
 * Annulation sécurisée d'un paiement (soft-cancel : statut = 'annule').
 * Garanties :
 *   1. JWT + agency_id serveur
 *   2. Vérification propriété du paiement
 *   3. Idempotent si déjà annulé
 *   4. Entrée de reversal dans ledger_entries
 *   5. Suppression de la ligne revenus associée
 *   6. Log dans event_log
 *
 * Appelé via : supabase.functions.invoke('cancel-paiement', { body: { id, raison? } })
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

const CancelPaiementSchema = z.object({
  id: z.string().uuid({ message: "id doit être un UUID valide" }),
  raison: z.string().max(300).optional(),
});

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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST" && req.method !== "DELETE") {
    return err("Méthode non autorisée — utilisez POST.", 405);
  }

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

    // ── 2. Profil + agency_id ────────────────────────────────────────────────
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
    const rawBody = await readBody(req);
    if (!rawBody) return err("JSON invalide.", 400, "INVALID_JSON");

    const parsed = CancelPaiementSchema.safeParse(rawBody);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return err(`Données invalides — ${details}`, 422, "VALIDATION_ERROR");
    }

    const { id, raison } = parsed.data;

    // ── 4. Récupération paiement (vérification propriété) ────────────────────
    const { data: paiement, error: fetchErr } = await supabaseAdmin
      .from("paiements")
      .select("id, statut, montant_total, part_agence, part_bailleur, agency_id, contrat_id")
      .eq("id", id)
      .eq("agency_id", agencyId)
      .single();

    if (fetchErr || !paiement) {
      return err("Paiement introuvable ou accès refusé.", 404, "NOT_FOUND");
    }

    // Idempotent : déjà annulé = succès silencieux
    if (paiement.statut === "annule") {
      return json({ data: { id, statut: "annule", already_cancelled: true } }, 200);
    }

    // ── 5. Soft-cancel : statut = 'annule' ───────────────────────────────────
    const { data: cancelled, error: cancelErr } = await supabaseAdmin
      .from("paiements")
      .update({
        statut: "annule",
        notes: raison ? `Annulé : ${raison}` : "Annulé",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("agency_id", agencyId)
      .select()
      .single();

    if (cancelErr) {
      return err(cancelErr.message, 422, cancelErr.code ?? "DB_ERROR");
    }

    // ── 6. Suppression revenus associés ──────────────────────────────────────
    await supabaseAdmin
      .from("revenus")
      .delete()
      .eq("paiement_id", id)
      .catch(() => {});

    // ── 7. Ledger reversal ───────────────────────────────────────────────────
    if (paiement.montant_total && paiement.montant_total > 0) {
      await supabaseAdmin.from("ledger_entries").insert([
        {
          agency_id: agencyId,
          type: "annulation",
          direction: "debit",
          montant: paiement.montant_total,
          reference_type: "paiements",
          reference_id: id,
          description: raison ? `Annulation : ${raison}` : "Annulation paiement",
          created_by: user.id,
        },
      ]).catch(() => {});
    }

    // ── 8. Log event ─────────────────────────────────────────────────────────
    await supabaseAdmin.from("event_log").insert({
      agency_id: agencyId,
      event_type: "paiement.cancelled",
      entity_type: "paiements",
      entity_id: id,
      payload: { raison: raison ?? null, montant: paiement.montant_total, cancelled_by: user.id },
      created_by: user.id,
    }).catch(() => {});

    return json({ data: cancelled }, 200);
  } catch (_err) {
    return err("Erreur serveur inattendue.", 500, "INTERNAL_ERROR");
  }
});
