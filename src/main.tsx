import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { initSentry } from './lib/sentry';
import { initAnalytics } from './lib/analytics';
import { registerServiceWorker } from './services/serviceWorkerRegistration';
import './index.css';

initSentry();
initAnalytics();
registerServiceWorker();

const CHUNK_RECOVERY_KEY = 'sk_chunk_recovery_last_reload';
const CHUNK_RECOVERY_COOLDOWN_MS = 30_000;

function isDynamicImportError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|preload/i.test(message);
}

async function clearAppRuntimeCaches() {
  if (!('caches' in window)) return;
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((name) => name.startsWith('samay-keur-'))
      .map((name) => caches.delete(name)),
  );
}

function shouldRecoverChunkLoad() {
  try {
    const lastReload = Number(sessionStorage.getItem(CHUNK_RECOVERY_KEY) ?? '0');
    if (Date.now() - lastReload < CHUNK_RECOVERY_COOLDOWN_MS) return false;
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(Date.now()));
  } catch {
    /* noop */
  }
  return true;
}

function recoverFromChunkLoadError(reason: unknown) {
  if (!shouldRecoverChunkLoad()) {
    console.error('[runtime] chunk recovery skipped to avoid reload loop', reason);
    return;
  }

  console.warn('[runtime] recovering from stale or unavailable route chunk', reason);
  void clearAppRuntimeCaches()
    .catch((error) => {
      console.warn('[runtime] cache cleanup failed before chunk recovery', error);
    })
    .finally(() => {
      if ('serviceWorker' in navigator) {
        void navigator.serviceWorker.getRegistration().then((registration) => registration?.update());
      }
      window.location.reload();
    });
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  recoverFromChunkLoadError(event);
});

window.addEventListener('unhandledrejection', (event) => {
  if (!isDynamicImportError(event.reason)) return;
  event.preventDefault();
  recoverFromChunkLoadError(event.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
