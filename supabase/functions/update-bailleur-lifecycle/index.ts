/**
 * Edge Function : update-bailleur-lifecycle
 *
 * Lifecycle bailleur enterprise :
 * - agency_id injecte cote serveur
 * - permission RBAC bailleurs:update
 * - impacts calcules avant validation finale
 * - audit trail append-only via event_log
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const BailleurStatuts = ["resilie", "suspendu", "archive", "cloture"] as const;

const UpdateBailleurLifecycleSchema = z.object({
  id: z.string().uuid({ message: "id doit etre un UUID valide" }),
  statut: z.enum(BailleurStatuts),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "format YYYY-MM-DD" }),
  motif: z.string().trim().min(3).max(240),
  observations: z.string().trim().max(1200).nullable().optional(),
  acknowledge_impacts: z.boolean().default(false),
});

type UpdateBailleurLifecycleInput = z.infer<typeof UpdateBailleurLifecycleSchema>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function err(message: string, status = 400, code?: string, details?: unknown) {
  return json({ error: message, ...(code ? { code } : {}), ...(details ? { details } : {}) }, status);
}

async function countRows(
  supabaseAdmin: ReturnType<typeof createClient>,
  table: string,
  filters: Record<string, string | string[]>,
): Promise<number> {
  let query = supabaseAdmin.from(table).select("id", { count: "exact", head: true });
  Object.entries(filters).forEach(([key, value]) => {
    query = Array.isArray(value) ? query.in(key, value) : query.eq(key, value);
  });
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "PATCH" && req.method !== "POST") {
    return err("Methode non autorisee. Utilisez PATCH ou POST.", 405);
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

    const { data: canUpdateBailleurs, error: permissionErr } = await supabaseAdmin.rpc(
      "fn_user_can",
      { p_user_id: user.id, p_page: "bailleurs", p_action: "update" },
    );
    if (permissionErr) {
      console.error("[update-bailleur-lifecycle] RBAC check failed", permissionErr.message);
      return err("Verification des permissions indisponible.", 500, "RBAC_CHECK_FAILED");
    }
    if (!canUpdateBailleurs) {
      return err("Action refusee par les permissions de l'agence.", 403, "RBAC_FORBIDDEN");
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return err("JSON invalide.", 400, "INVALID_JSON");
    }

    const parsed = UpdateBailleurLifecycleSchema.safeParse(rawBody);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return err(`Donnees invalides - ${details}`, 422, "VALIDATION_ERROR");
    }

    const input: UpdateBailleurLifecycleInput = parsed.data;

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("bailleurs")
      .select("id, nom, prenom, statut, agency_id")
      .eq("id", input.id)
      .eq("agency_id", agencyId)
      .single();

    if (fetchErr || !existing) {
      return err("Bailleur introuvable ou acces refuse.", 404, "NOT_FOUND");
    }

    const { data: immeubles, error: immeublesErr } = await supabaseAdmin
      .from("immeubles")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("bailleur_id", input.id)
      .eq("actif", true);
    if (immeublesErr) return err(immeublesErr.message, 422, "IMPACT_IMMEUBLES_FAILED");

    const immeubleIds = (immeubles ?? []).map((row: { id: string }) => row.id);
    let unitesActives = 0;
    let contratsActifs = 0;
    if (immeubleIds.length > 0) {
      unitesActives = await countRows(supabaseAdmin, "unites", {
        agency_id: agencyId,
        immeuble_id: immeubleIds,
      });

      const { data: uniteRows, error: unitesErr } = await supabaseAdmin
        .from("unites")
        .select("id")
        .eq("agency_id", agencyId)
        .in("immeuble_id", immeubleIds);
      if (unitesErr) return err(unitesErr.message, 422, "IMPACT_UNITES_FAILED");

      const uniteIds = (uniteRows ?? []).map((row: { id: string }) => row.id);
      if (uniteIds.length > 0) {
        contratsActifs = await countRows(supabaseAdmin, "contrats", {
          agency_id: agencyId,
          unite_id: uniteIds,
          statut: "actif",
        });
      }
    }

    const impacts = {
      immeubles_actifs: immeubleIds.length,
      unites_liees: unitesActives,
      contrats_actifs: contratsActifs,
    };

    if ((contratsActifs > 0 || unitesActives > 0) && !input.acknowledge_impacts) {
      return err(
        "Des biens ou contrats actifs sont lies a ce bailleur. Confirmez les impacts avant validation.",
        409,
        "IMPACTS_ACK_REQUIRED",
        impacts,
      );
    }

    const now = new Date().toISOString();
    const patch = {
      statut: input.statut,
      actif: input.statut === "suspendu",
      resiliation_date: input.date,
      resiliation_motif: input.motif,
      resiliation_observations: input.observations ?? null,
      resiliation_by: user.id,
      lifecycle_updated_at: now,
      updated_at: now,
    };

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("bailleurs")
      .update(patch)
      .eq("id", input.id)
      .eq("agency_id", agencyId)
      .select()
      .single();

    if (updateErr) return err(updateErr.message, 422, updateErr.code ?? "DB_ERROR");

    const { error: eventErr } = await supabaseAdmin.from("event_log").insert({
      agency_id: agencyId,
      event_type: "bailleur.lifecycle.updated",
      entity_type: "bailleurs",
      entity_id: input.id,
      payload: {
        previous_statut: existing.statut ?? "actif",
        new_statut: input.statut,
        motif: input.motif,
        observations: input.observations ?? null,
        date: input.date,
        impacts,
        updated_by: user.id,
      },
      created_by: user.id,
    });
    if (eventErr) {
      console.warn("[update-bailleur-lifecycle] event_log insert failed", eventErr.message);
    }

    return json({ data: updated, impacts }, 200);
  } catch (error) {
    console.error("[update-bailleur-lifecycle] unexpected", error);
    return err("Erreur serveur inattendue.", 500, "INTERNAL_ERROR");
  }
});
