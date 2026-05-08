import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BrandMark } from '../components/brand/BrandLogo';

export function Auth() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nom: '',
    prenom: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await signIn(formData.email, formData.password);
      } else {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Les mots de passe ne correspondent pas');
        }
        if (formData.password.length < 6) {
          throw new Error('Le mot de passe doit contenir au moins 6 caractères');
        }
        if (!formData.nom.trim() || !formData.prenom.trim()) {
          throw new Error('Le nom et le prénom sont obligatoires');
        }

        await signUp(formData.email, formData.password, {
          nom: formData.nom,
          prenom: formData.prenom,
          role: 'admin',
        });
      }
    } catch (err: unknown) {
      console.error('Auth error:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sk-splash-screen relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,138,0,0.12),transparent_22rem),linear-gradient(115deg,rgba(8,17,14,0.92),rgba(13,27,22,0.78)_52%,rgba(242,237,227,0.9)_52%,rgba(251,250,246,0.96))]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(242,237,227,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(242,237,227,0.035)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="pointer-events-none absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-action-500/16 blur-3xl" />

      <div className="relative w-full max-w-md py-4 sm:py-8">
        <div className="sk-card-premium overflow-hidden border-white/70 bg-white/[0.9] shadow-[0_32px_120px_rgba(6,17,13,0.32)] animate-scaleIn">
          <div className="p-6 sm:p-8">
            <div className="mb-8 text-center">
              <BrandMark size="xl" tone="light" animated className="mx-auto mb-4" />
              <p className="text-xs font-black uppercase tracking-[0.34em] text-action-600">Manage. Grow. Prosper.</p>
              <h1 className="mt-3 text-2xl font-black tracking-[0.12em] text-brand-950">SAMAY KËUR</h1>
              <p className="mt-4 text-slate-600">
                Votre gestion locative, simplifiée et automatisée.
              </p>
              <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-900/10 bg-emerald-50 px-3 py-2 text-xs font-black text-brand-800">
                <ShieldCheck className="h-4 w-4" />
                Espace sécurisé
              </div>
            </div>

            <div className="mb-6 flex gap-2 rounded-lg border border-emerald-950/10 bg-brand-surface p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex-1 rounded-lg px-4 py-3 font-semibold transition-all duration-300 ${
                  mode === 'login'
                    ? 'bg-brand-950 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <LogIn className="mr-2 inline-block h-5 w-5" />
                Connexion
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`flex-1 rounded-lg px-4 py-3 font-semibold transition-all duration-300 ${
                  mode === 'register'
                    ? 'bg-brand-950 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <UserPlus className="mr-2 inline-block h-5 w-5" />
                Inscription
              </button>
            </div>

            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 animate-slideInUp">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'register' && (
                <div className="grid grid-cols-2 gap-4 animate-slideInLeft">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Prénom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.prenom}
                      onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                      className="sk-input w-full px-4 py-3"
                      placeholder="Amadou"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Nom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      className="sk-input w-full px-4 py-3"
                      placeholder="Diop"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="sk-input w-full px-4 py-3"
                  placeholder="votre@email.com"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Mot de passe <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="sk-input w-full px-4 py-3 pr-12"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {mode === 'register' && <p className="mt-2 text-xs text-slate-500">Minimum 6 caractères</p>}
              </div>

              {mode === 'register' && (
                <div className="animate-slideInRight">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Confirmer le mot de passe <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="sk-input w-full px-4 py-3"
                    placeholder="••••••••"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full transform items-center justify-center gap-2 rounded-lg bg-brand-700 px-6 py-3 font-bold text-white shadow-premium transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>{mode === 'login' ? 'Connexion...' : 'Inscription...'}</span>
                  </>
                ) : (
                  <>
                    {mode === 'login' ? <LogIn className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                    <span>{mode === 'login' ? 'Se connecter' : "S'inscrire"}</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              {mode === 'login' ? (
                <p className="text-sm text-slate-600">
                  Pas encore de compte ?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                    }}
                    className="font-bold text-brand-700 transition-colors hover:text-brand-900 hover:underline"
                  >
                    Créez-en un
                  </button>
                </p>
              ) : (
                <p className="text-sm text-slate-600">
                  Vous avez déjà un compte ?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="font-bold text-brand-700 transition-colors hover:text-brand-900 hover:underline"
                  >
                    Connectez-vous
                  </button>
                </p>
              )}
            </div>
          </div>

          {mode === 'register' && (
            <div className="border-t border-emerald-950/10 bg-brand-surface px-8 py-6">
              <p className="text-center text-xs text-slate-600">
                En vous inscrivant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
