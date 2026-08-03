import { useSyncExternalStore } from 'react';
import {
  closeDocumentGeneration,
  getDocumentGenerationSnapshot,
  runDocumentGeneration,
  subscribeDocumentGeneration,
} from '../lib/documentGeneration';

export function useDocumentGeneration() {
  const session = useSyncExternalStore(
    subscribeDocumentGeneration,
    getDocumentGenerationSnapshot,
    getDocumentGenerationSnapshot,
  );

  return {
    session,
    generate: runDocumentGeneration,
    close: closeDocumentGeneration,
  };
}
