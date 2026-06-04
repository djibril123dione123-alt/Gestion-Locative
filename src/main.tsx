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

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
