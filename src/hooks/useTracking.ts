import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { trackEvent } from '../lib/analytics';

export type TrackingAction =
  | 'login'
  | 'logout'
  | 'page_view'
  | 'contrat_create'
  | 'contrat_update'
  | 'paiement_create'
  | 'bailleur_create'
  | 'locataire_create'
  | 'immeuble_create'
  | 'pdf_generate'
  | 'subscription_pay'
  | 'export_excel'
  | 'intervention_create'
  | 'inventaire_create';

interface TrackPayload {
  action: TrackingAction;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
}

export function useTracking() {
  const { user } = useAuth();

  const track = useCallback(
    async ({ action, entity_type, entity_id, metadata }: TrackPayload) => {
      if (!user) return;
      trackEvent(action, {
        entity_type: entity_type ?? action,
        entity_id: entity_id ?? null,
        ...metadata,
      });
    },
    [user]
  );

  return { track };
}
