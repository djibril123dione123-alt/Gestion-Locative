import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * Bannière globale de maintenance.
 *
 * Lit la clé `maintenance_mode` dans la table `saas_config`. Si la valeur est
 * truthy, affiche un bandeau orange en haut de l'app pour informer les
 * utilisateurs. Échec silencieux si la requête échoue (la table peut ne pas
 * être lisible par tous les rôles).
 */
export function MaintenanceBanner() {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data, error } = await supabase
          .from('saas_config')
          .select('value')
          .eq('key', 'maintenance_mode')
          .maybeSingle();

        if (cancelled || error || !data) return;

        const value = data.value as unknown;
        if (typeof value === 'boolean') {
          setActive(value);
        } else if (typeof value === 'object' && value !== null) {
          const obj = value as { enabled?: boolean; message?: string };
          setActive(Boolean(obj.enabled));
          if (obj.message) setMessage(obj.message);
        } else if (typeof value === 'string') {
          setActive(value === 'true');
        }
      } catch {
        // silencieux : la bannière n'est pas critique
      }
    }

    load();
    // Re-vérifier toutes les 5 minutes
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!active) return null;

  return (
    <div className="bg-orange-100 border-b border-orange-300 px-4 py-2 flex items-start gap-2 sticky top-0 z-40">
      <AlertTriangle className="w-5 h-5 text-orange-700 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-orange-900">
        <span className="font-semibold">Maintenance en cours.</span>{' '}
        {message ||
          "Certaines fonctionnalités peuvent être temporairement indisponibles. Merci de votre patience."}
      </div>
    </div>
  );
}
