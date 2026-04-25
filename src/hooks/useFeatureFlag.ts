import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook lecteur du toggle `feature_flags`.
 *
 * Politique de résolution :
 *   1. Si une ligne existe pour `(flag, agency_id = profile.agency_id)`, on
 *      prend sa valeur.
 *   2. Sinon, si une ligne globale existe pour `(flag, agency_id IS NULL)`,
 *      on prend sa valeur.
 *   3. Sinon, on retombe sur `defaultValue` (false par défaut).
 *
 * @param flag         Nom du flag (ex : "console.bilans_mensuels")
 * @param defaultValue Valeur par défaut si aucune ligne ne match
 */
export function useFeatureFlag(flag: string, defaultValue = false) {
  const { profile } = useAuth();
  const [enabled, setEnabled] = useState<boolean>(defaultValue);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data, error } = await supabase
          .from('feature_flags')
          .select('agency_id, enabled')
          .eq('flag', flag);

        if (cancelled) return;
        if (error) throw error;

        const rows = data ?? [];
        const agencyRow = profile?.agency_id
          ? rows.find((r) => r.agency_id === profile.agency_id)
          : undefined;
        const globalRow = rows.find((r) => r.agency_id === null);

        if (agencyRow) {
          setEnabled(Boolean(agencyRow.enabled));
        } else if (globalRow) {
          setEnabled(Boolean(globalRow.enabled));
        } else {
          setEnabled(defaultValue);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(`useFeatureFlag(${flag}) error:`, err);
          setEnabled(defaultValue);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [flag, profile?.agency_id, defaultValue]);

  return { enabled, loading };
}
