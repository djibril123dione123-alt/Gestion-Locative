import { useEffect, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';

export interface DirectRouteConfig {
  onNew?: (params: URLSearchParams) => void;
  onSelectId?: (id: string, params: URLSearchParams) => void;
}

export function useDirectRoute(config: DirectRouteConfig) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const onNewRef = useRef(config.onNew);
  const onSelectIdRef = useRef(config.onSelectId);

  onNewRef.current = config.onNew;
  onSelectIdRef.current = config.onSelectId;

  useEffect(() => {
    const action = searchParams.get('action');
    const id =
      searchParams.get('id') ||
      searchParams.get('bailleurId') ||
      searchParams.get('bienId') ||
      searchParams.get('uniteId') ||
      searchParams.get('locationId') ||
      searchParams.get('locataireId') ||
      searchParams.get('contratId') ||
      searchParams.get('paiementId') ||
      searchParams.get('creanceId') ||
      searchParams.get('depenseId') ||
      searchParams.get('docId');
    const isNewRoute = location.pathname.endsWith('/nouveau') || location.pathname.endsWith('/nouvelle') || location.pathname.endsWith('/nouveau-locataire') || location.pathname.endsWith('/nouvelle-location');

    if (action === 'new' || action?.startsWith('new-') || isNewRoute) {
      onNewRef.current?.(searchParams);
    } else if (id) {
      onSelectIdRef.current?.(id, searchParams);
    }
  }, [location.pathname, searchParams]);

  const clearDirectRouteParams = () => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    const keysToRemove = [
      'action',
      'id',
      'bailleurId',
      'bienId',
      'uniteId',
      'locationId',
      'locataireId',
      'contratId',
      'paiementId',
      'creanceId',
      'depenseId',
      'docId',
      'userId',
      'tab',
    ];
    for (const key of keysToRemove) {
      if (next.has(key)) {
        next.delete(key);
        changed = true;
      }
    }
    if (changed) {
      setSearchParams(next, { replace: true });
    }
  };

  return { clearDirectRouteParams, searchParams };
}
