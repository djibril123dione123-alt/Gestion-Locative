import { useMemo } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { getSemanticDictionary } from '../constants/dictionary';
import type { AccountProfile } from '../lib/accountProfile';

export function useAccountConfig(): AccountProfile & {
  dictionary: ReturnType<typeof getSemanticDictionary>;
} {
  const { accountProfile } = useAuth();

  return useMemo(
    () => ({
      ...accountProfile,
      dictionary: getSemanticDictionary(accountProfile.organizationType),
    }),
    [accountProfile]
  );
}
