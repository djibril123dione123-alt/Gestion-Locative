import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
  const { user, profile } = useAuth();

  const track = useCallback(
    async ({ action, entity_type, entity_id, metadata }: TrackPayload) => {
      if (!user) return;
      try {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          agency_id: profile?.agency_id ?? null,
          action,
          entity_type: entity_type ?? action,
          entity_id: entity_id ?? null,
          metadata: metadata ?? {},
          created_at: new Date().toISOString(),
        });
      } catch {
        // Tracking must never break app flow — fail silently
      }
    },
    [user, profile?.agency_id]
  );

  return { track };
}
