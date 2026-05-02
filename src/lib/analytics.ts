/**
 * analytics.ts — PostHog analytics wrapper
 *
 * Initialisation optionnelle : si VITE_POSTHOG_KEY n'est pas défini,
 * toutes les fonctions sont des no-ops (pas d'erreur, pas de tracking).
 *
 * Variables d'environnement :
 *   VITE_POSTHOG_KEY   — clé publique PostHog (obligatoire pour activer)
 *   VITE_POSTHOG_HOST  — endpoint PostHog (défaut : https://eu.posthog.com)
 *
 * Utilisation :
 *   initAnalytics()           — à appeler une fois au démarrage
 *   identifyUser(id, props)   — après connexion
 *   trackPageView(page)       — à chaque changement de route
 *   trackEvent(name, props)   — événements métier (paiement_created, etc.)
 *   resetAnalytics()          — à la déconnexion
 */

import posthog from 'posthog-js';

const POSTHOG_KEY = (import.meta.env.VITE_POSTHOG_KEY as string | undefined) ?? '';
const POSTHOG_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ??
  'https://eu.posthog.com';

let _initialized = false;

export function initAnalytics(): void {
  if (!POSTHOG_KEY || _initialized) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    disable_session_recording: false,
  });

  _initialized = true;
}

export function identifyUser(
  userId: string,
  props: {
    email?: string;
    role?: string;
    agency_id?: string | null;
    [key: string]: unknown;
  } = {},
): void {
  if (!_initialized) return;
  posthog.identify(userId, props);
}

export function trackPageView(page: string): void {
  if (!_initialized) return;
  posthog.capture('$pageview', {
    $current_url: window.location.href,
    page,
  });
}

export function trackEvent(
  event: string,
  props: Record<string, unknown> = {},
): void {
  if (!_initialized) return;
  posthog.capture(event, props);
}

export function resetAnalytics(): void {
  if (!_initialized) return;
  posthog.reset();
}

export function isAnalyticsEnabled(): boolean {
  return _initialized;
}
