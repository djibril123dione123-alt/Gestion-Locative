import * as Sentry from '@sentry/react';

export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_ENV || 'development';

  if (!dsn) {
    console.warn('Sentry DSN not configured, error monitoring disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    // Session Replay
    replaysSessionSampleRate: environment === 'production' ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    // Release tracking
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',
    // User context
    beforeSend: (event) => {
      // Sanitize sensitive data
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });

  console.log(`Sentry initialized for ${environment} environment`);
};