/**
 * Edge Function : renew-contrat
 *
 * Renouvellement metier Occupants & Baux.
 * Ne modifie pas l'ancien bail pour "prolonger" sa periode :
 * - l'ancien bail devient expire ;
 * - un nouveau bail actif est cree pour la nouvelle periode ;
 * - l'unite reste occupee ;
 * - event_log garde la trace du renouvellement.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const RenewContratSchema = z.object({
  id: z.string().uuid({ message: "id doit etre un UUID valide" }),
  nouvelle_date_fin: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "format YYYY-MM-DD" }),
  nouveau_loyer: z.number().min(1).nullable().optional(),
  remarques: z.string().trim().max(1000).nullable().optional(),
});

type RenewContratInput = z.infer<typeof RenewContratSchema>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function err(message: string, status = 400, code?: string) {
  return json({ error: message, ...(code ? { code } : {}) }, status);
}

function addOneDay(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return err("Methode non autorisee.", 405, "METHOD_NOT_ALLOWED");

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

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
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

    if (profile.role === "bailleur" && !isIndividualOwnerAccount) {
      return err("Acces refuse.", 403, "FORBIDDEN_ROLE");
    }

    if (!(isIndividualOwnerAccount && profile.role === "bailleur")) {
      const { data: canUpdateContrat, error: permissionErr } = await supabaseAdmin.rpc(
        "fn_user_can",
        { p_user_id: user.id, p_page: "contrats", p_action: "update" },
      );
      if (permissionErr) return err("Verification des permissions indisponible.", 500, "RBAC_CHECK_FAILED");
      if (!canUpdateContrat) return err("Action refusee par les permissions de l'agence.", 403, "RBAC_FORBIDDEN");
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return err("JSON invalide.", 400, "INVALID_JSON");
    }

    const parsed = RenewContratSchema.safeParse(rawBody);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return err(`Donnees invalides - ${details}`, 422, "VALIDATION_ERROR");
    }

    const input: RenewContratInput = parsed.data;

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("contrats")
      .select("id, agency_id, locataire_id, unite_id, date_debut, date_fin, loyer_mensuel, commission, caution, statut, destination")
      .eq("id", input.id)
      .eq("agency_id", agencyId)
      .single();

    if (fetchErr || !existing) return err("Contrat introuvable ou acces refuse.", 404, "NOT_FOUND");
    if (!["actif", "expire"].includes(existing.statut)) {
      return err("Seuls les baux actifs ou expires peuvent etre renouveles.", 422, "INVALID_RENEWAL_STATUS");
    }
    if (!existing.date_fin) {
      return err("Le bail doit avoir une date de fin pour etre renouvele.", 422, "MISSING_END_DATE");
    }

    const newStart = addOneDay(existing.date_fin);
    if (input.nouvelle_date_fin <= newStart) {
      return err("La nouvelle date de fin doit etre posterieure au debut de renouvellement.", 422, "INVALID_RENEWAL_END_DATE");
    }

    if (existing.statut === "expire") {
      const { data: activeConflict, error: activeConflictErr } = await supabaseAdmin
        .from("contrats")
        .select("id")
        .eq("agency_id", agencyId)
        .eq("unite_id", existing.unite_id)
        .eq("statut", "actif")
        .neq("id", existing.id)
        .maybeSingle();

      if (activeConflictErr) {
        return err("Verification de disponibilite de l'unite impossible.", 500, "UNIT_AVAILABILITY_CHECK_FAILED");
      }
      if (activeConflict) {
        return err(
          "Un bail actif existe deja pour cette unite. Impossible de renouveler.",
          409,
          "CONTRAT_ALREADY_EXISTS",
        );
      }
    }

    if (existing.statut === "actif") {
      const { error: closeErr } = await supabaseAdmin
        .from("contrats")
        .update({
          statut: "expire",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("agency_id", agencyId);
      if (closeErr) return err(closeErr.message, 422, closeErr.code ?? "CONTRAT_CLOSE_FAILED");
    }

    const newPayload = {
      agency_id: agencyId,
      locataire_id: existing.locataire_id,
      unite_id: existing.unite_id,
      date_debut: newStart,
      date_fin: input.nouvelle_date_fin,
      loyer_mensuel: input.nouveau_loyer ?? existing.loyer_mensuel,
      commission: isIndividualOwnerAccount ? 0 : existing.commission,
      caution: existing.caution,
      statut: "actif",
      destination: existing.destination,
      notes: input.remarques ?? null,
      created_by: user.id,
    };

    const { data: renewed, error: insertErr } = await supabaseAdmin
      .from("contrats")
      .insert([newPayload])
      .select()
      .single();

    if (insertErr) {
      if (existing.statut === "actif") {
        await supabaseAdmin
          .from("contrats")
          .update({ statut: existing.statut, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .eq("agency_id", agencyId);
      }
      return err(insertErr.message, 422, insertErr.code ?? "RENEWAL_INSERT_FAILED");
    }

    const { error: unitErr } = await supabaseAdmin
      .from("unites")
      .update({ statut: "loue" })
      .eq("id", existing.unite_id)
      .eq("agency_id", agencyId);

    if (unitErr) {
      await supabaseAdmin.from("contrats").delete().eq("id", renewed.id).eq("agency_id", agencyId);
      if (existing.statut === "actif") {
        await supabaseAdmin
          .from("contrats")
          .update({ statut: existing.statut, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .eq("agency_id", agencyId);
      }
      return err("Le renouvellement a ete annule car l'unite n'a pas pu etre occupee.", 409, "UNITE_OCCUPATION_FAILED");
    }

    const now = new Date().toISOString();
    const { error: eventErr } = await supabaseAdmin.from("event_log").insert([
      {
        agency_id: agencyId,
        event_type: "contrat.renewed",
        entity_type: "contrats",
        entity_id: existing.id,
        payload: {
          previous_contract_id: existing.id,
          new_contract_id: renewed.id,
          previous_date_fin: existing.date_fin,
          new_date_debut: newStart,
          new_date_fin: input.nouvelle_date_fin,
          previous_loyer: existing.loyer_mensuel,
          new_loyer: newPayload.loyer_mensuel,
          remarks: input.remarques ?? null,
        },
        created_by: user.id,
        created_at: now,
      },
      {
        agency_id: agencyId,
        event_type: "contrat.created",
        entity_type: "contrats",
        entity_id: renewed.id,
        payload: {
          source: "renewal",
          previous_contract_id: existing.id,
          new_date_debut: newStart,
          new_date_fin: input.nouvelle_date_fin,
        },
        created_by: user.id,
        created_at: now,
      },
    ]);

    if (eventErr) {
      await supabaseAdmin.from("contrats").delete().eq("id", renewed.id).eq("agency_id", agencyId);
      if (existing.statut === "actif") {
        await supabaseAdmin
          .from("contrats")
          .update({ statut: existing.statut, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .eq("agency_id", agencyId);
      }
      return err("Le renouvellement a ete annule car l'historique n'a pas pu etre enregistre.", 500, "EVENT_LOG_FAILED");
    }

    return json({ data: renewed }, 200);
  } catch {
    return err("Erreur serveur inattendue.", 500, "INTERNAL_ERROR");
  }
});
