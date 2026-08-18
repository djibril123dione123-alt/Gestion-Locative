/**
 * Source de vérité unique pour l'URL canonique de l'application, côté Edge
 * Functions. Toujours https://app.samaykeur.com en production. Surchargeable
 * via la variable d'environnement APP_URL (Supabase Edge Functions secrets) —
 * si une URL périmée (ex: un ancien domaine Replit) apparaît en production,
 * corriger le secret APP_URL, jamais ce fichier.
 */
const DEFAULT_APP_URL = "https://app.samaykeur.com";

export function getAppUrl(): string {
  const configured = Deno.env.get("APP_URL");
  return (configured && configured.trim()) || DEFAULT_APP_URL;
}
