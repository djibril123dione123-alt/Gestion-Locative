/**
 * cancel-paiement
 *
 * Soft-cancels a payment. The database trigger is the single writer for ledger
 * reversal, which keeps cancellation idempotent and append-only.
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
  id: z.string().uuid({ message: "id doit etre un UUID valide" }),
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
    return err("Methode non autorisee. Utilisez POST.", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return err("Token manquant.", 401, "NOT_AUTHENTICATED");
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
    if (authErr || !user) return err("Token invalide.", 401, "INVALID_TOKEN");

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
    if (!profile.actif) return err("Compte desactive.", 403, "ACCOUNT_DISABLED");

    const agencyId: string = profile.agency_id;
    if (!agencyId) return err("Aucune agence associee.", 403, "NO_AGENCY");

    const { data: agency, error: agencyErr } = await supabaseAdmin
      .from("agencies")
      .select("is_bailleur_account")
      .eq("id", agencyId)
      .single();
    if (agencyErr || !agency) return err("Espace introuvable.", 403, "AGENCY_NOT_FOUND");
    const isIndividualOwnerAccount = agency.is_bailleur_account === true;

    if (profile.role === "bailleur" && !isIndividualOwnerAccount) return err("Acces refuse.", 403, "FORBIDDEN_ROLE");

    if (!(isIndividualOwnerAccount && profile.role === "bailleur")) {
      const { data: canDeletePaiement, error: permissionErr } = await supabaseAdmin.rpc(
        "fn_user_can",
        { p_user_id: user.id, p_page: "paiements", p_action: "delete" },
      );
      if (permissionErr) {
        console.error("[cancel-paiement] RBAC check failed", permissionErr.message);
        return err("Verification des permissions indisponible.", 500, "RBAC_CHECK_FAILED");
      }
      if (!canDeletePaiement) {
        return err("Action refusee par les permissions de l'agence.", 403, "RBAC_FORBIDDEN");
      }
    }

    const rawBody = await readBody(req);
    if (!rawBody) return err("JSON invalide.", 400, "INVALID_JSON");

    const parsed = CancelPaiementSchema.safeParse(rawBody);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      return err(`Donnees invalides : ${details}`, 422, "VALIDATION_ERROR");
    }

    const { id, raison } = parsed.data;

    const { data: paiement, error: fetchErr } = await supabaseAdmin
      .from("paiements")
      .select("id, statut, montant_total, agency_id")
      .eq("id", id)
      .eq("agency_id", agencyId)
      .single();

    if (fetchErr || !paiement) {
      return err("Paiement introuvable ou acces refuse.", 404, "NOT_FOUND");
    }

    if (paiement.statut === "annule") {
      return json({ data: { id, statut: "annule", already_cancelled: true } }, 200);
    }

    const { data: cancelled, error: cancelErr } = await supabaseAdmin
      .from("paiements")
      .update({
        statut: "annule",
        notes: raison ? `Annule : ${raison}` : "Annule",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("agency_id", agencyId)
      .select()
      .single();

    if (cancelErr) return err(cancelErr.message, 422, cancelErr.code ?? "DB_ERROR");

    const { error: revenusErr } = await supabaseAdmin
      .from("revenus")
      .delete()
      .eq("paiement_id", id);
    if (revenusErr) {
      console.warn("[cancel-paiement] revenus cleanup failed", revenusErr.message);
    }

    const { error: eventErr } = await supabaseAdmin.from("event_log").insert({
      agency_id: agencyId,
      event_type: "paiement.cancelled",
      entity_type: "paiements",
      entity_id: id,
      payload: { raison: raison ?? null, montant: paiement.montant_total, cancelled_by: user.id },
      created_by: user.id,
    });
    if (eventErr) console.warn("[cancel-paiement] event_log insert failed", eventErr.message);

    return json({ data: cancelled }, 200);
  } catch (unexpected) {
    console.error("[cancel-paiement] unexpected error", unexpected);
    return err("Erreur serveur inattendue.", 500, "INTERNAL_ERROR");
  }
});
