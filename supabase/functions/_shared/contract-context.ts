import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const CONTRACT_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

export function contractJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CONTRACT_CORS });
}

export function contractError(message: string, status = 400, code?: string, details?: unknown) {
  return contractJson(
    { error: message, ...(code ? { code } : {}), ...(details ? { details } : {}) },
    status,
  );
}

export interface ContractCommandContext {
  admin: SupabaseClient;
  agencyId: string;
  userId: string;
  isIndividualOwnerAccount: boolean;
}

export async function resolveContractCommandContext(
  req: Request,
  action: "create" | "update",
): Promise<ContractCommandContext | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return contractError("Token manquant.", 401, "NOT_AUTHENTICATED");
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    return contractError("Configuration serveur indisponible.", 500, "SERVER_CONFIG_MISSING");
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return contractError("Token invalide.", 401, "INVALID_TOKEN");
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("agency_id, role, actif")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return contractError("Profil introuvable.", 403, "PROFILE_NOT_FOUND");
  }
  if (!profile.actif) {
    return contractError("Compte désactivé.", 403, "ACCOUNT_DISABLED");
  }
  if (!profile.agency_id) {
    return contractError("Aucune organisation associée.", 403, "NO_AGENCY");
  }

  const { data: agency, error: agencyError } = await admin
    .from("agencies")
    .select("is_bailleur_account")
    .eq("id", profile.agency_id)
    .single();
  if (agencyError || !agency) {
    return contractError("Espace introuvable.", 403, "AGENCY_NOT_FOUND");
  }

  const isIndividualOwnerAccount = agency.is_bailleur_account === true;
  if (profile.role === "bailleur" && !isIndividualOwnerAccount) {
    return contractError("Accès refusé.", 403, "FORBIDDEN_ROLE");
  }

  if (!(isIndividualOwnerAccount && profile.role === "bailleur")) {
    const { data: allowed, error: permissionError } = await admin.rpc("fn_user_can", {
      p_user_id: user.id,
      p_page: "contrats",
      p_action: action,
    });
    if (permissionError) {
      console.error("[contract-command] RBAC check failed", permissionError.message);
      return contractError(
        "Vérification des permissions indisponible.",
        500,
        "RBAC_CHECK_FAILED",
      );
    }
    if (!allowed) {
      return contractError(
        "Action refusée par les permissions de l'organisation.",
        403,
        "RBAC_FORBIDDEN",
      );
    }
  }

  return {
    admin,
    agencyId: profile.agency_id,
    userId: user.id,
    isIndividualOwnerAccount,
  };
}

export function contractRpcFailure(error: { message: string; code?: string }) {
  const code = error.message || error.code || "CONTRACT_COMMAND_FAILED";
  const conflicts = new Set([
    "CONTRAT_ALREADY_EXISTS",
    "UNITE_OCCUPATION_FAILED",
    "UNITE_RELEASE_FAILED",
  ]);
  const missing = new Set([
    "CONTRAT_NOT_FOUND",
    "LOCATAIRE_NOT_FOUND",
    "UNITE_NOT_FOUND",
    "AGENCY_NOT_FOUND",
  ]);
  const invalid = new Set([
    "INVALID_CONTRACT_CONTEXT",
    "INVALID_CONTRACT_VALUES",
    "INVALID_CONTRACT_COMMISSION",
    "INVALID_CONTRACT_CAUTION",
    "INVALID_CONTRACT_END_DATE",
    "INVALID_CONTRACT_TRANSITION",
    "INVALID_RENEWAL_CONTEXT",
    "INVALID_RENEWAL_STATUS",
    "INVALID_RENEWAL_END_DATE",
    "INVALID_RENEWAL_RENT",
    "MISSING_END_DATE",
    "RESILIATION_DATE_REQUIRED",
    "UNSUPPORTED_CONTRACT_PATCH",
  ]);

  const status = conflicts.has(code) ? 409 : missing.has(code) ? 404 : invalid.has(code) ? 422 : 500;
  const messages: Record<string, string> = {
    CONTRAT_ALREADY_EXISTS: "Un bail actif existe déjà pour cette unité.",
    CONTRAT_NOT_FOUND: "Contrat introuvable ou accès refusé.",
    LOCATAIRE_NOT_FOUND: "Locataire introuvable dans cette organisation.",
    UNITE_NOT_FOUND: "Unité introuvable dans cette organisation.",
    INVALID_CONTRACT_TRANSITION: "Cette transition de statut n'est pas autorisée.",
    INVALID_CONTRACT_END_DATE: "La date de fin du bail est invalide.",
    INVALID_RENEWAL_END_DATE: "La nouvelle date de fin est invalide.",
    RESILIATION_DATE_REQUIRED: "La date de résiliation est obligatoire.",
  };

  return contractError(
    messages[code] ?? "L'opération sur le bail n'a pas pu être finalisée.",
    status,
    code,
  );
}
