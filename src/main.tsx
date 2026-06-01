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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
