import { useAccountConfig } from './useAccountConfig';

export function useFeatures() {
  return useAccountConfig().features;
}
