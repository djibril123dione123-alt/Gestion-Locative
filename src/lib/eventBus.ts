/**
 * eventBus.ts — Émetteur d'événements universel Samay Këur
 *
 * Envoie les événements métier vers PostHog (analytics & funnels).
 * Les mutations financières sont tracées côté serveur via Edge Functions
 * et triggers PostgreSQL — event_outbox / event_log sont réservés au
 * service_role et ne doivent PAS être écrits depuis le client.
 */

import { trackEvent } from './analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppEvent {
  type: string;
  agency_id?: string | null;
  entity_type?: string;
  entity_id?: string;
  payload?: Record<string, unknown>;
  source?: 'frontend' | 'edge-function' | 'cron';
}

// ─── Fonction universelle ─────────────────────────────────────────────────────

/**
 * Émet un événement métier vers PostHog.
 * Les écritures SQL (event_outbox, event_log) sont gérées exclusivement
 * côté serveur (Edge Functions, triggers) pour respecter les politiques RLS.
 */
export function emitEvent(event: AppEvent): void {
  const { type, agency_id, entity_type, entity_id, payload, source = 'frontend' } = event;

  trackEvent(type, {
    ...(payload ?? {}),
    agency_id: agency_id ?? undefined,
    entity_type,
    entity_id,
    source,
  });
}

// ─── Helpers typés ────────────────────────────────────────────────────────────

export function emitPaiementEvent(
  type: 'paiement.created' | 'paiement.updated' | 'paiement.cancelled',
  props: { agency_id?: string | null; entity_id?: string; payload?: Record<string, unknown> },
): void {
  emitEvent({ type, entity_type: 'paiements', source: 'frontend', ...props });
}

export function emitContratEvent(
  type: 'contrat.created' | 'contrat.updated',
  props: { agency_id?: string | null; entity_id?: string; payload?: Record<string, unknown> },
): void {
  emitEvent({ type, entity_type: 'contrats', source: 'frontend', ...props });
}
