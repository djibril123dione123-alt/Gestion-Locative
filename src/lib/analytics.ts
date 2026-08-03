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
import { safeTelemetryPath, sanitizeTelemetryData } from './telemetryPrivacy';

const POSTHOG_KEY = (import.meta.env.VITE_POSTHOG_KEY as string | undefined) ?? '';
const POSTHOG_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ??
  'https://eu.posthog.com';
const SESSION_RECORDING_ENABLED =
  import.meta.env.VITE_POSTHOG_SESSION_RECORDING_ENABLED === 'true';

let _initialized = false;

export function initAnalytics(): void {
  if (!POSTHOG_KEY || _initialized) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    disable_session_recording: !SESSION_RECORDING_ENABLED,
    mask_all_text: true,
    mask_all_element_attributes: true,
  });

  _initialized = true;
}

export function identifyUser(
  userId: string,
  props: {
    role?: string;
    account_type?: string;
    [key: string]: unknown;
  } = {},
): void {
  if (!_initialized) return;
  posthog.identify(userId, sanitizeTelemetryData(props) as Record<string, unknown>);
}

export function trackPageView(page: string): void {
  if (!_initialized) return;
  posthog.capture('$pageview', {
    $current_url: `${window.location.origin}${safeTelemetryPath(window.location.pathname)}`,
    page: safeTelemetryPath(page),
  });
}

export function trackEvent(
  event: string,
  props: Record<string, unknown> = {},
): void {
  if (!_initialized) return;
  posthog.capture(event, sanitizeTelemetryData(props) as Record<string, unknown>);
}

export function resetAnalytics(): void {
  if (!_initialized) return;
  posthog.reset();
}

export function isAnalyticsEnabled(): boolean {
  return _initialized;
}
