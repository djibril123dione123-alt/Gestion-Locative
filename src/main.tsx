import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { initSentry } from './lib/sentry';
import { initAnalytics } from './lib/analytics';
import './index.css';

initSentry();
initAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
