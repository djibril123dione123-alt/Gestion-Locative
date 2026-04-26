import { useCallback } from 'react';
import * as Sentry from '@sentry/react';

interface UserContext {
  userId?: string;
  email?: string;
  agencyId?: string;
  role?: string;
}

interface ErrorContext {
  component?: string;
  action?: string;
  data?: Record<string, any>;
}

export const useErrorReporting = () => {
  const captureError = useCallback((error: Error, context?: ErrorContext, userContext?: UserContext) => {
    Sentry.withScope((scope) => {
      // Ajouter le contexte utilisateur
      if (userContext) {
        scope.setUser({
          id: userContext.userId,
          email: userContext.email,
        });
        scope.setTag('agency_id', userContext.agencyId || 'unknown');
        scope.setTag('user_role', userContext.role || 'unknown');
      }

      // Ajouter le contexte de l'erreur
      if (context) {
        scope.setTag('component', context.component || 'unknown');
        scope.setTag('action', context.action || 'unknown');

        if (context.data) {
          scope.setContext('additional_data', context.data);
        }
      }

      // Capturer l'erreur
      Sentry.captureException(error);
    });
  }, []);

  const captureMessage = useCallback((message: string, level: Sentry.SeverityLevel = 'info', context?: ErrorContext & UserContext) => {
    Sentry.withScope((scope) => {
      // Définir le niveau de sévérité
      scope.setLevel(level);

      // Ajouter le contexte
      if (context) {
        if (context.userId || context.email) {
          scope.setUser({
            id: context.userId,
            email: context.email,
          });
        }
        scope.setTag('agency_id', context.agencyId || 'unknown');
        scope.setTag('user_role', context.role || 'unknown');
        scope.setTag('component', context.component || 'unknown');
        scope.setTag('action', context.action || 'unknown');

        if (context.data) {
          scope.setContext('additional_data', context.data);
        }
      }

      // Capturer le message
      Sentry.captureMessage(message);
    });
  }, []);

  const setUserContext = useCallback((user: UserContext) => {
    Sentry.setUser({
      id: user.userId,
      email: user.email,
    });
    Sentry.setTag('agency_id', user.agencyId || 'unknown');
    Sentry.setTag('user_role', user.role || 'unknown');
  }, []);

  const clearUserContext = useCallback(() => {
    Sentry.setUser(null);
    Sentry.setTag('agency_id', 'unknown');
    Sentry.setTag('user_role', 'unknown');
  }, []);

  return {
    captureError,
    captureMessage,
    setUserContext,
    clearUserContext,
  };
};