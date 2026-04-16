import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#fff7ed', fontFamily: 'sans-serif', padding: '2rem' }}>
          <div style={{ textAlign: 'center', maxWidth: '500px', background: 'white', borderRadius: '1rem', padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
            <h1 style={{ color: '#c2410c', fontSize: '1.5rem', marginBottom: '1rem' }}>Erreur de configuration</h1>
            <p style={{ color: '#475569', marginBottom: '1rem' }}>
              L'application n'a pas pu se connecter au serveur. Veuillez vérifier que les variables d'environnement Supabase sont correctement configurées.
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>{this.state.error.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
