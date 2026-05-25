import React, { useEffect, useState } from 'react';
import { AlertCircle, Eye, EyeOff, LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BrandLogo, BrandMark } from '../components/brand/BrandLogo';

interface AuthProps {
  initialMode?: 'login' | 'register';
}

export function Auth({ initialMode = 'login' }: AuthProps) {
  const { signIn, signInWithGoogle, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nom: '',
    prenom: '',
  });

  useEffect(() => {
    setMode(initialMode);
    setError(null);
  }, [initialMode]);

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
        if (!formData.prenom.trim() || !formData.nom.trim()) {
          throw new Error('Le pr�nom et le nom sont obligatoires');
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

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      console.error('Google auth error:', err);
      setError(err instanceof Error ? err.message : 'Connexion Google impossible pour le moment');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="sk-splash-screen relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,138,0,0.12),transparent_22rem),linear-gradient(115deg,rgba(8,17,14,0.94),rgba(13,27,22,0.82)_48%,rgba(242,237,227,0.88)_48%,rgba(251,250,246,0.96))]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(242,237,227,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(242,237,227,0.035)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="pointer-events-none absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-action-500/16 blur-3xl" />

      <div className="relative grid w-full max-w-6xl min-w-0 gap-6 py-3 sm:py-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch">
        <aside className="relative hidden min-h-[38rem] overflow-hidden rounded-[2rem] border border-white/12 bg-emerald-950 shadow-[0_36px_140px_rgba(6,17,13,0.38)] lg:block">
          <img
            src="/brand/marketing/landing-centralisation.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-[0.82]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,17,13,0.08),rgba(6,17,13,0.78)),radial-gradient(circle_at_20%_10%,rgba(255,138,0,0.22),transparent_18rem)]" />
          <div className="relative flex h-full flex-col justify-between p-8 text-white">
            <BrandLogo size="sm" tone="dark" showTagline />
            <div className="max-w-md">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-100">Accès sécurisé</p>
              <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight">
                Une infrastructure immobilière sérieuse commence dès la connexion.
              </h2>
              <p className="mt-5 text-sm font-semibold leading-7 text-emerald-50/72">
                Documents, paiements, GED, rapports et permissions restent protégés dans un espace pensé pour les agences professionnelles.
              </p>
            </div>
          </div>
        </aside>

        <div className="w-full min-w-0 lg:max-w-md lg:justify-self-end">
          <div className="sk-card-premium overflow-hidden border-white/70 bg-white/[0.92] shadow-[0_32px_120px_rgba(6,17,13,0.32)] animate-scaleIn">
            <div className="p-5 sm:p-8">
            <div className="mb-6 text-center sm:mb-8">
              <BrandMark size="lg" tone="light" animated className="mx-auto mb-4" />
              <p className="text-xs font-black uppercase tracking-[0.34em] text-action-600">Manage. Grow. Prosper.</p>
              <h1 className="mt-3 text-xl font-black tracking-[0.12em] text-brand-950 sm:text-2xl">SAMAY KËUR</h1>
              <p className="mx-auto mt-4 max-w-xs text-sm leading-6 text-slate-600 sm:text-base">
                Votre gestion locative, simplifiée et automatisée.
              </p>
              <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-900/10 bg-emerald-50 px-3 py-2 text-xs font-black text-brand-800">
                <ShieldCheck className="h-4 w-4" />
                Espace sécurisé
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-emerald-950/10 bg-brand-surface p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`min-w-0 rounded-lg px-2 py-3 text-sm font-black transition-all duration-300 sm:px-4 sm:text-base ${
                  mode === 'login'
                    ? 'bg-brand-950 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <LogIn className="mr-1.5 inline-block h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" />
                Connexion
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`min-w-0 rounded-lg px-2 py-3 text-sm font-black transition-all duration-300 sm:px-4 sm:text-base ${
                  mode === 'register'
                    ? 'bg-brand-950 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <UserPlus className="mr-1.5 inline-block h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" />
                <span className="sm:hidden">Créer</span>
                <span className="hidden sm:inline">Inscription</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
              className="group mb-5 flex w-full items-center justify-center gap-3 rounded-xl border border-emerald-950/10 bg-white px-4 py-3 font-black text-slate-900 shadow-[0_14px_38px_rgba(6,17,13,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/40 hover:shadow-[0_20px_48px_rgba(6,17,13,0.12)] focus:outline-none focus:ring-2 focus:ring-action-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-black text-slate-950 shadow-sm transition-transform duration-300 group-hover:scale-105">
                {googleLoading ? (
                  <span className="h-4 w-4 rounded-full border-2 border-brand-700 border-t-transparent animate-spin" />
                ) : (
                  <img src="/brand/google-g.png" alt="" className="h-5 w-5 object-contain" />
                )}
              </span>
              <span>{googleLoading ? 'Ouverture de Google...' : 'Continuer avec Google'}</span>
            </button>

            <div className="mb-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-emerald-950/10" />
              <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">ou par email</span>
              <span className="h-px flex-1 bg-emerald-950/10" />
            </div>

            {error && (
              <div id="auth-error" className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 animate-slideInUp">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" aria-describedby={error ? 'auth-error' : undefined}>
              {mode === 'register' && (
                <div className="grid grid-cols-2 gap-4 animate-slideInLeft">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Prénom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="given-name"
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
                      autoComplete="family-name"
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
                  autoComplete="email"
                  aria-invalid={!!error}
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
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    aria-invalid={!!error}
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
                    autoComplete="new-password"
                    aria-invalid={!!error}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="sk-input w-full px-4 py-3"
                    placeholder="••••••••"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading || googleLoading}
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
    </div>
  );
}


