import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { BrandLogo } from '../brand/BrandLogo';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch {
      setError('Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_18%,rgba(52,211,153,0.18),transparent_24rem),linear-gradient(135deg,#06110d,#0d3b2c_54%,#f7f3ea_54%,#fbfaf6)] p-4">
      <div className="relative w-full max-w-md rounded-lg border border-emerald-900/10 bg-white/95 p-8 shadow-premium backdrop-blur">
        <div className="mb-8 flex items-center justify-center">
          <BrandLogo size="lg" tone="light" animated showTagline stacked className="items-center justify-center" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="sk-input w-full px-4 py-3"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="sk-input w-full px-4 py-3"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg bg-brand-700 px-4 py-3 font-bold text-white shadow-premium transition hover:-translate-y-0.5 hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          © 2026 Samay Këur. Tous droits réservés.
        </p>
      </div>
    </div>
  );
}
