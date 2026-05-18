import React from 'react';
import * as Sentry from '@sentry/react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { BrandMark } from './brand/BrandLogo';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return (
        <div className="premium-polish flex min-h-screen items-center justify-center bg-brand-paper p-4">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-emerald-900/10 bg-white p-7 text-center shadow-2xl shadow-emerald-950/10">
            <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-orange-400/10 blur-3xl" />
            <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />

            <div className="relative">
              <BrandMark size="lg" tone="light" animated className="mx-auto mb-5" />
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">
                Incident applicatif
              </p>
              <h1 className="mt-3 text-2xl font-black text-slate-950">Une erreur est survenue</h1>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">
                L'interface a été protégée pour éviter une page blanche. Vous pouvez relancer l'écran ou actualiser la page.
              </p>
            </div>

            <div className="relative mt-6 grid gap-3 sm:grid-cols-2">
              <button
                onClick={this.resetError}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-900 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/15 transition hover:-translate-y-0.5 hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
              >
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center rounded-2xl border border-emerald-900/10 bg-brand-surface px-4 py-3 text-sm font-black text-brand-900 transition hover:-translate-y-0.5 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
              >
                Actualiser
              </button>
            </div>

            {import.meta.env.DEV && (
              <details className="relative mt-5 text-left">
                <summary className="cursor-pointer text-sm font-semibold text-slate-500">Détails de l'erreur</summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded-2xl bg-red-50 p-3 text-xs text-red-700">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
