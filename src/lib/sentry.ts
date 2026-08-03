import * as Sentry from '@sentry/react';
import { redactTelemetryString, sanitizeTelemetryData } from './telemetryPrivacy';

export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_ENV || 'development';
  const replayEnabled = import.meta.env.VITE_SENTRY_REPLAY_ENABLED === 'true';

  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment,
    integrations: [
      Sentry.browserTracingIntegration(),
      ...(replayEnabled
        ? [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })]
        : []),
    ],
    // Performance Monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    // Session Replay
    replaysSessionSampleRate: replayEnabled ? 0.02 : 0,
    replaysOnErrorSampleRate: replayEnabled ? 0.2 : 0,
    // Release tracking
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',
    // User context
    beforeSend: (event) => {
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      if (event.request) {
        event.request.data = sanitizeTelemetryData(event.request.data);
        event.request.headers = sanitizeTelemetryData(event.request.headers) as Record<string, string>;
        if (event.request.url) event.request.url = event.request.url.split('?')[0];
      }
      event.extra = sanitizeTelemetryData(event.extra) as typeof event.extra;
      event.contexts = sanitizeTelemetryData(event.contexts) as typeof event.contexts;
      event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => ({
        ...breadcrumb,
        message: breadcrumb.message ? redactTelemetryString(breadcrumb.message) : undefined,
        data: sanitizeTelemetryData(breadcrumb.data) as typeof breadcrumb.data,
      }));
      event.exception?.values?.forEach((exception) => {
        if (exception.value) exception.value = redactTelemetryString(exception.value);
      });
      return event;
    },
  });

};
