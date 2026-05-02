/**
 * eventBus.ts — Émetteur d'événements universel Samay Këur
 *
 * UNE seule fonction pour toute la chaîne événementielle :
 *   1. Persiste dans event_log (PostgreSQL) — auditabilité SQL
 *   2. Envoie à PostHog — analytics & funnels
 *
 * Les triggers DB côté Edge Functions génèrent des events automatiquement
 * pour les mutations financières. Ce bus complète avec les events frontend
 * (navigation, interactions) et les events sans entity_id connu.
 *
 * Utilisation :
 *   await emitEvent({
 *     type: 'paiement.created',
 *     agency_id: profile.agency_id,
 *     entity_type: 'paiements',
 *     entity_id: paiement.id,
 *     payload: { montant: 150000 },
 *   });
 */

import { supabase } from './supabase';
import { trackEvent } from './analytics';

// ─── event_outbox writer (source de vérité primaire) ─────────────────────────
async function writeOutbox(event: AppEvent): Promise<void> {
  if (!event.agency_id) return;
  supabase
    .from('event_outbox')
    .insert({
      agency_id:   event.agency_id,
      event_type:  event.type,
      entity_type: event.entity_type ?? 'unknown',
      entity_id:   event.entity_id ?? null,
      payload:     event.payload ?? {},
      source:      event.source ?? 'frontend',
      status:      'pending',
    })
    .then(() => {})
    .catch(() => {}); // fire-and-forget
}

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
 * Émet un événement métier vers SQL (event_log) ET PostHog.
 * Gracieux : les erreurs SQL ne bloquent jamais l'UX.
 */
export async function emitEvent(event: AppEvent): Promise<void> {
  const { type, agency_id, entity_type, entity_id, payload, source = 'frontend' } = event;

  // ── 1. event_outbox — source primaire (déclenche workers + jobs) ─────────────
  writeOutbox({ type, agency_id, entity_type, entity_id, payload, source });

  // ── 2. event_log — audit trail secondaire ────────────────────────────────────
  if (agency_id) {
    supabase
      .from('event_log')
      .insert({
        agency_id,
        event_type:  type,
        entity_type: entity_type ?? 'unknown',
        entity_id:   entity_id ?? null,
        payload:     { ...(payload ?? {}), source },
      })
      .then(() => {})
      .catch(() => {});
  }

  // ── 3. PostHog analytics ─────────────────────────────────────────────────────
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
): Promise<void> {
  return emitEvent({ type, entity_type: 'paiements', source: 'frontend', ...props });
}

export function emitContratEvent(
  type: 'contrat.created' | 'contrat.updated',
  props: { agency_id?: string | null; entity_id?: string; payload?: Record<string, unknown> },
): Promise<void> {
  return emitEvent({ type, entity_type: 'contrats', source: 'frontend', ...props });
}
