/**
 * Source de vérité unique pour l'URL canonique de l'application (frontend).
 *
 * Utilisée pour construire tout redirectTo Supabase Auth (OAuth, réinitialisation
 * de mot de passe) et tout lien absolu vers l'app elle-même. Ne jamais reconstruire
 * cette logique ailleurs — importer getAppOrigin()/getAppRedirectUrl() à la place.
 */

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

export function getAppOrigin(): string {
  const configured = (
    import.meta.env.VITE_PUBLIC_APP_URL ||
    import.meta.env.VITE_APP_URL ||
    ''
  ).replace(/\/+$/, '');

  const isLocal =
    typeof window !== 'undefined' && LOCAL_HOSTNAMES.has(window.location.hostname);

  if (isLocal || !configured) {
    return typeof window !== 'undefined' ? window.location.origin : configured;
  }
  return configured;
}

/**
 * URL absolue vers un chemin RÉEL (non-hash) de l'app, ex: getAppRedirectUrl('/login').
 * Ne jamais y inclure de route HashRouter (ex: '/#/abonnement') : Supabase Auth
 * remplace tout fragment existant par le sien (#access_token=...) lors des flux
 * OAuth/recovery, ce qui écraserait silencieusement une route encodée ici.
 */
export function getAppRedirectUrl(path: string): string {
  const origin = getAppOrigin();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${cleanPath}`;
}
