import { useCallback, useRef } from 'react';

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

export function useRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}) {
  const { maxAttempts = 3, baseDelayMs = 1000, maxDelayMs = 8000, onRetry } = options;
  const abortRef = useRef(false);

  const execute = useCallback(async (): Promise<T> => {
    abortRef.current = false;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (abortRef.current) throw new Error('Aborted');
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt === maxAttempts || abortRef.current) break;
        const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
        onRetry?.(attempt, err);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError;
  }, [fn, maxAttempts, baseDelayMs, maxDelayMs, onRetry]);

  const abort = useCallback(() => { abortRef.current = true; }, []);

  return { execute, abort };
}
