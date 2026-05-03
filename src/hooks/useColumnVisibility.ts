import { useState, useCallback } from 'react';

export type ColumnVisibilityMap = Record<string, boolean>;

/**
 * Persists column visibility preferences in localStorage.
 * @param tableKey  Unique identifier for the table (e.g. 'paiements', 'contrats').
 * @param allKeys   Ordered list of all available column keys.
 * @param defaults  Optional map of keys that should be hidden by default.
 */
export function useColumnVisibility(
  tableKey: string,
  allKeys: string[],
  defaults: Partial<ColumnVisibilityMap> = {},
) {
  const storageKey = `col_visibility_${tableKey}`;

  const buildInitial = (): ColumnVisibilityMap => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as ColumnVisibilityMap;
        // Merge: new columns default to true, unknown keys are dropped
        const merged: ColumnVisibilityMap = {};
        allKeys.forEach((k) => {
          merged[k] = k in parsed ? parsed[k] : (defaults[k] ?? true);
        });
        return merged;
      }
    } catch {
      // ignore parse errors
    }
    const initial: ColumnVisibilityMap = {};
    allKeys.forEach((k) => {
      initial[k] = defaults[k] ?? true;
    });
    return initial;
  };

  const [visibility, setVisibility] = useState<ColumnVisibilityMap>(buildInitial);

  const toggle = useCallback(
    (key: string) => {
      setVisibility((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // ignore storage errors
        }
        return next;
      });
    },
    [storageKey],
  );

  const setAll = useCallback(
    (visible: boolean) => {
      setVisibility((prev) => {
        const next: ColumnVisibilityMap = {};
        Object.keys(prev).forEach((k) => {
          next[k] = visible;
        });
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // ignore storage errors
        }
        return next;
      });
    },
    [storageKey],
  );

  const isVisible = useCallback(
    (key: string) => visibility[key] !== false,
    [visibility],
  );

  const visibleCount = Object.values(visibility).filter(Boolean).length;

  return { visibility, toggle, setAll, isVisible, visibleCount };
}
