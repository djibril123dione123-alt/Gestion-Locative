/**
 * Edge Function : update-contrat
 *
 * Garanties :
 *   1. JWT + agency_id injecté côté serveur
 *   2. Validation Zod
 *   3. Vérification propriété du contrat
 *   4. Libération de l'unité si statut → 'resilie' ou 'expire'
 *   5. Log event_log (contrat.updated)
 *
 * Appelé via : supabase.functions.invoke('update-contrat', { body })
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

const UpdateContratSchema = z.object({
  id: z.string().uuid({ message: "id doit être un UUID valide" }),
  statut: z.enum(ContratStatuts).optional(),
  date_fin: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "format YYYY-MM-DD" })
    .nullable()
    .optional(),
  commission: z
    .number()
    .min(0)
    .max(100, { message: "commission entre 0 et 100" })
    .nullable()
    .optional(),
  caution: z.number().min(0).nullable().optional(),
});

type UpdateContratInput = z.infer<typeof UpdateContratSchema>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}
function err(message: string, status = 400, code?: string) {
  return json({ error: message, ...(code ? { code } : {}) }, status);
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
      .from("profiles")
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

    const parsed = UpdateContratSchema.safeParse(rawBody);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return err(`Données invalides — ${details}`, 422, "VALIDATION_ERROR");
    }

    const input: UpdateContratInput = parsed.data;

    // ── 4. Récupération contrat (propriété + unite_id) ────────────────────────
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("contrats")
      .select("id, statut, unite_id, agency_id")
      .eq("id", input.id)
      .eq("agency_id", agencyId)
      .single();

    if (fetchErr || !existing) {
      return err("Contrat introuvable ou accès refusé.", 404, "NOT_FOUND");
    }

    // ── 4b. State machine — validation transition ─────────────────────────────
    const CONTRAT_TRANSITIONS: Record<string, string[]> = {
      actif:   ["expire", "resilie"],
      expire:  ["actif"],
      resilie: [],
    };

    if (input.statut && input.statut !== existing.statut) {
      const allowed = CONTRAT_TRANSITIONS[existing.statut as string] ?? [];
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
    if (input.statut !== undefined) patch.statut = input.statut;
    if (input.date_fin !== undefined) patch.date_fin = input.date_fin;
    if (input.commission !== undefined) patch.commission = input.commission;
    if (input.caution !== undefined) patch.caution = input.caution;

    // ── 6. UPDATE contrat ────────────────────────────────────────────────────
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("contrats")
      .update(patch)
      .eq("id", input.id)
      .eq("agency_id", agencyId)
      .select()
      .single();

    if (updateErr) {
      return err(updateErr.message, 422, updateErr.code ?? "DB_ERROR");
    }

    // ── 7. Libération unité si résiliation / expiration ──────────────────────
    const uniteFinalStatuts = ["resilie", "expire"] as const;
    const newStatut = input.statut;
    const wasNotTerminated = existing.statut === "actif";

    if (newStatut && uniteFinalStatuts.includes(newStatut as typeof uniteFinalStatuts[number]) && wasNotTerminated) {
      await supabaseAdmin
        .from("unites")
        .update({ statut: "libre" })
        .eq("id", existing.unite_id)
        .eq("agency_id", agencyId)
        .catch(() => {});
    }

    // ── 8. Log event ─────────────────────────────────────────────────────────
    await supabaseAdmin.from("event_log").insert({
      agency_id: agencyId,
      event_type: "contrat.updated",
      entity_type: "contrats",
      entity_id: input.id,
      payload: { patch, previous_statut: existing.statut, updated_by: user.id },
      created_by: user.id,
    }).catch(() => {});

    return json({ data: updated }, 200);
  } catch (_err) {
    return err("Erreur serveur inattendue.", 500, "INTERNAL_ERROR");
  }
});
