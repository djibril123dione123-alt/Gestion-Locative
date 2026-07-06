import React, { useEffect, useState } from 'react';
import { AlertCircle, Eye, EyeOff, LogIn, ShieldCheck, Sparkles, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BrandLogo, BrandMark } from '../components/brand/BrandLogo';

interface AuthProps {
  initialMode?: 'login' | 'register';
}

const TERMS_VERSION = '2026-05-31';
const PRIVACY_VERSION = '2026-05-31';
const TERMS_URL = 'https://samaykeur.com/cgu';
const PRIVACY_URL = 'https://samaykeur.com/confidentialite';
const GOOGLE_OAUTH_CONFIG_ERROR =
  'Connexion Google indisponible pour le moment. Vérifiez la configuration OAuth.';

function getGoogleAuthErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? '');
  const lowerMessage = message.toLowerCase();
  if (
    lowerMessage.includes('unsupported provider') ||
    lowerMessage.includes('provider is not enabled') ||
    lowerMessage.includes('google provider')
  ) {
    return GOOGLE_OAUTH_CONFIG_ERROR;
  }
  return err instanceof Error ? err.message : 'Connexion Google impossible pour le moment.';
}

export function Auth({ initialMode = 'login' }: AuthProps) {
  const { signIn, signInWithGoogle, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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
    setAcceptedTerms(false);
  }, [initialMode]);

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setRegisterStep(1);
    setError(null);
    setAcceptedTerms(false);
  };

  const validateRegisterForm = () => {
    if (formData.password !== formData.confirmPassword) {
      throw new Error('Les mots de passe ne correspondent pas.');
    }
    if (formData.password.length < 6) {
      throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
    }
    if (!formData.prenom.trim() || !formData.nom.trim()) {
      throw new Error('Le prénom et le nom sont obligatoires.');
    }
    if (!acceptedTerms) {
      throw new Error('Vous devez accepter les CGU et la politique de confidentialité pour créer votre compte.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await signIn(formData.email, formData.password);
      } else {
        validateRegisterForm();
        const acceptedAt = new Date().toISOString();

        await signUp(formData.email, formData.password, {
          nom: formData.nom.trim(),
          prenom: formData.prenom.trim(),
          role: 'admin',
          accepted_terms_at: acceptedAt,
          accepted_privacy_at: acceptedAt,
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
        });
      }
    } catch (err: unknown) {
      console.error('Auth error:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    if (mode === 'register' && !acceptedTerms) {
      setError('Vous devez accepter les CGU et la politique de confidentialité pour créer votre compte.');
      return;
    }

    const acceptedAt = mode === 'register' ? new Date().toISOString() : undefined;

    setGoogleLoading(true);
    try {
      await signInWithGoogle(
        acceptedAt
          ? {
              acceptedTermsAt: acceptedAt,
              acceptedPrivacyAt: acceptedAt,
              termsVersion: TERMS_VERSION,
              privacyVersion: PRIVACY_VERSION,
            }
          : undefined,
      );
    } catch (err: unknown) {
      console.error('Google auth error:', err);
      setError(getGoogleAuthErrorMessage(err));
      setGoogleLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-brand-950 text-white">
      <img
        src="/brand/image-fond-page-connexion-samay-keur.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-[58%_center] opacity-95 sm:object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,10,8,0.86)_0%,rgba(6,17,13,0.72)_34%,rgba(6,17,13,0.34)_62%,rgba(6,17,13,0.72)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(255,138,0,0.16),transparent_22rem),radial-gradient(circle_at_78%_84%,rgba(52,211,153,0.12),transparent_20rem)]" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/55 to-transparent" />

      <section className="relative z-10 flex min-h-[100dvh] flex-col overflow-y-auto px-3 py-4 pb-7 sm:px-4 lg:px-5">
        <div className="mx-auto my-auto grid w-full max-w-4xl items-center gap-4 lg:grid-cols-[0.9fr_0.68fr] pb-safe">
          <aside className="hidden min-h-[27rem] flex-col justify-between rounded-xl border border-white/12 bg-white/[0.045] p-4 shadow-[0_18px_56px_rgba(0,0,0,0.3)] backdrop-blur-md lg:flex">
            <BrandLogo size="sm" tone="dark" showTagline />

            <div className="max-w-xl">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/20 bg-amber-100/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.18em] text-amber-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                Accès sécurisé
              </div>
              <h1 className="mt-3 text-2xl font-black leading-[1.04] tracking-tight text-white drop-shadow-2xl">
                L'immobilier maîtrisé commence par un accès fiable.
              </h1>
              <p className="mt-2.5 max-w-md text-xs font-semibold leading-5 text-emerald-50/78">
                Paiements, documents vérifiables, rapports bailleurs et permissions restent protégés dans une infrastructure pensée pour les professionnels.
              </p>
            </div>

            <div className="grid max-w-xl grid-cols-3 gap-2">
              {['Contrôle total', 'Transparence QR', 'Finance claire'].map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-black/22 px-3 py-2 backdrop-blur">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-100">{item}</p>
                </div>
              ))}
            </div>
          </aside>

          <div className="mx-auto w-full max-w-[22.5rem] lg:mx-0 lg:justify-self-end">
            <div className="mb-4 flex justify-center lg:hidden">
              <BrandLogo size="sm" tone="dark" showTagline />
            </div>

            <div className="overflow-hidden rounded-xl border border-white/35 bg-white/[0.9] text-brand-950 shadow-[0_18px_56px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
              <div className="border-b border-emerald-950/10 bg-gradient-to-br from-white/92 to-brand-surface/88 px-3.5 py-3 sm:px-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-900/10 bg-emerald-50 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.16em] text-brand-800">
                      <Sparkles className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                      Espace privé
                    </div>
                    <h2 className="mt-1.5 font-serif text-lg font-black tracking-tight text-brand-950">
                      {mode === 'login' ? 'Connexion' : 'Créer votre espace'}
                    </h2>
                    <p className="mt-1 text-[0.7rem] font-semibold leading-4 text-slate-600">
                      {mode === 'login'
                        ? 'Accédez à votre console de gestion locative.'
                        : 'Lancez votre espace sécurisé Samay Këur.'}
                    </p>
                  </div>
                  <BrandMark size="md" tone="light" animated className="mt-1 flex-shrink-0" />
                </div>
              </div>

              <div className="px-3.5 py-2.5 sm:px-4">
                <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-emerald-950/10 bg-brand-surface p-1">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className={`min-h-9 rounded-lg px-2.5 text-xs font-black transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-action-500/20 ${
                      mode === 'login'
                        ? 'bg-brand-950 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white hover:text-brand-900'
                    }`}
                  >
                    <LogIn className="mr-1 inline-block h-3.5 w-3.5" />
                    Connexion
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className={`min-h-9 rounded-lg px-2.5 text-xs font-black transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-action-500/20 ${
                      mode === 'register'
                        ? 'bg-brand-950 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white hover:text-brand-900'
                    }`}
                  >
                    <UserPlus className="mr-1 inline-block h-3.5 w-3.5" />
                    <span className="sm:hidden">Créer</span>
                    <span className="hidden sm:inline">Inscription</span>
                  </button>
                </div>



                {mode === 'login' || (mode === 'register' && registerStep === 2 && acceptedTerms) ? (
                  <div className="mb-3 mt-2.5">
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={loading || googleLoading}
                      className="group flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-emerald-950/10 bg-white px-3 py-1.5 text-[0.7rem] font-black text-slate-900 shadow-[0_8px_20px_rgba(6,17,13,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-[0_10px_24px_rgba(6,17,13,0.12)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-action-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-base font-black text-slate-950 shadow-sm transition-transform duration-300 group-hover:scale-105">
                        {googleLoading ? (
                          <span className="h-4 w-4 rounded-full border-2 border-brand-700 border-t-transparent animate-spin" />
                        ) : (
                          <img src="/brand/google-g.png" alt="" className="h-4 w-4 object-contain" />
                        )}
                      </span>
                      <span className="flex items-center pt-0.5">
                        {googleLoading ? 'Ouverture de Google...' : 'Continuer avec Google'}
                      </span>
                    </button>

                  </div>
                ) : null}

                <div className="mb-3 flex items-center gap-2.5">
                  <span className="h-px flex-1 bg-emerald-950/10" />
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">ou par email</span>
                  <span className="h-px flex-1 bg-emerald-950/10" />
                </div>

                {error && (
                  <div id="auth-error" className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 animate-slideInUp">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                    <p className="text-xs font-semibold leading-5 text-red-800">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-2.5" aria-describedby={error ? 'auth-error' : undefined}>
                  {mode === 'register' && registerStep === 1 && (
                    <div className="space-y-2.5 animate-slideInLeft">
                      <div className="grid grid-cols-2 gap-2.5">
                        <Field
                          label="Prénom"
                          required
                          inputProps={{
                            type: 'text',
                            autoComplete: 'given-name',
                            value: formData.prenom,
                            onChange: (e) => setFormData({ ...formData, prenom: e.target.value }),
                            placeholder: 'Amadou',
                            className: 'bg-[#fbfdfc]',
                          }}
                        />
                        <Field
                          label="Nom"
                          required
                          inputProps={{
                            type: 'text',
                            autoComplete: 'family-name',
                            value: formData.nom,
                            onChange: (e) => setFormData({ ...formData, nom: e.target.value }),
                            placeholder: 'Diop',
                            className: 'bg-[#fbfdfc]',
                          }}
                        />
                      </div>
                      <Field
                        label="Email"
                        required
                        inputProps={{
                          type: 'email',
                          autoComplete: 'email',
                          value: formData.email,
                          onChange: (e) => setFormData({ ...formData, email: e.target.value }),
                          placeholder: 'votre@email.com',
                          className: 'bg-[#fbfdfc]',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (formData.prenom.trim() && formData.nom.trim() && formData.email.trim()) {
                            setRegisterStep(2);
                            setError(null);
                          } else {
                            setError("Veuillez remplir votre prénom, nom et email pour continuer.");
                          }
                        }}
                        className="flex min-h-9 w-full transform items-center justify-center gap-2 rounded-lg bg-[#072F24] px-3 py-1.5 text-[0.7rem] font-black text-white shadow-[0_9px_24px_rgba(7,47,36,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#0A3F30] active:bg-[#041812] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-action-500/25"
                      >
                        Continuer
                      </button>
                    </div>
                  )}

                  {(mode === 'login' || (mode === 'register' && registerStep === 2)) && (
                    <div className="space-y-2.5 animate-slideInLeft">
                      {mode === 'login' && (
                        <Field
                          label="Email"
                          required
                          inputProps={{
                            type: 'email',
                            autoComplete: 'email',
                            value: formData.email,
                            onChange: (e) => setFormData({ ...formData, email: e.target.value }),
                            placeholder: 'votre@email.com',
                            className: 'bg-[#fbfdfc]',
                          }}
                        />
                      )}

                      <div>
                        <label className="mb-1.5 block text-xs font-black text-slate-700">
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
                            className="sk-input min-h-9 w-full border-emerald-950/10 bg-[#fbfdfc] px-3 py-1.5 pr-9 text-xs font-semibold shadow-sm transition hover:border-emerald-200 focus:border-action-500"
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-emerald-50 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-action-500/20"
                            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                          >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                        {mode === 'register' && <p className="mt-2 text-xs font-semibold text-slate-500">Minimum 6 caractères.</p>}
                      </div>

                      {mode === 'register' && (
                        <Field
                          label="Confirmer le mot de passe"
                          required
                          inputProps={{
                            type: 'password',
                            autoComplete: 'new-password',
                            value: formData.confirmPassword,
                            onChange: (e) => setFormData({ ...formData, confirmPassword: e.target.value }),
                            placeholder: '••••••••',
                            className: 'bg-[#fbfdfc]',
                          }}
                        />
                      )}

                      {mode === 'register' && (
                        <TermsConsent accepted={acceptedTerms} onChange={setAcceptedTerms} compact />
                      )}

                      <button
                        type="submit"
                        disabled={loading || googleLoading || (mode === 'register' && !acceptedTerms)}
                        className="flex min-h-9 w-full transform items-center justify-center gap-2 rounded-lg bg-[#072F24] px-3 py-1.5 text-[0.7rem] font-black text-white shadow-[0_9px_24px_rgba(7,47,36,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#0A3F30] active:bg-[#041812] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-action-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? (
                          <>
                            <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            <span>{mode === 'login' ? 'Connexion...' : 'Inscription...'}</span>
                          </>
                        ) : (
                          <>
                            {mode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                            <span>{mode === 'login' ? 'Se connecter' : "Créer mon espace"}</span>
                          </>
                        )}
                      </button>

                      {mode === 'register' && (
                        <button
                          type="button"
                          onClick={() => setRegisterStep(1)}
                          className="mt-3 flex w-full justify-center text-xs font-bold text-slate-500 transition hover:text-brand-800"
                        >
                          Retour
                        </button>
                      )}
                    </div>
                  )}
                </form>

                <p className="mt-4 text-center text-xs font-semibold text-slate-600">
                  {mode === 'login' ? 'Pas encore de compte ?' : 'Vous avez déjà un compte ?'}{' '}
                  <button
                    type="button"
                    onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                    className="font-black text-brand-700 underline-offset-4 transition-colors hover:text-brand-950 hover:underline"
                  >
                    {mode === 'login' ? 'Créer un espace' : 'Se connecter'}
                  </button>
                </p>
              </div>

              <div className="border-t border-emerald-950/10 bg-brand-surface/90 px-3.5 py-2.5 sm:px-4">
                <p className="text-center text-[0.68rem] font-semibold leading-4 text-slate-600">
                  Accès sécurisé. Vos données métier restent protégées et isolées par organisation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

type FieldProps = {
  label: string;
  required?: boolean;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
};

function Field({ label, required = false, inputProps }: FieldProps) {
  return (
    <div>
      <label className="mb-1 block text-[0.7rem] font-black text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        required={required}
        aria-invalid={inputProps['aria-invalid']}
        {...inputProps}
        className={`sk-input min-h-9 w-full border-emerald-950/10 bg-white/92 px-3 py-1.5 text-xs font-semibold shadow-sm transition hover:border-emerald-200 focus:border-action-500 ${inputProps.className ?? ''}`}
      />
    </div>
  );
}

function TermsConsent({
  accepted,
  onChange,
  compact = false,
}: {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  compact?: boolean;
}) {
  return (
    <label className={`mb-3 flex items-start gap-2.5 rounded-lg border border-brand-900/10 bg-[#fbfdfc] text-left text-[0.7rem] leading-4 text-slate-700 ${compact ? 'p-2.5' : 'p-2.5 sm:p-3'}`}>
      <input
        type="checkbox"
        checked={accepted}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 sm:mt-1 h-4 w-4 shrink-0 rounded border-emerald-950/20 text-brand-700 focus:ring-action-400"
      />
      <span>
        J'accepte les{' '}
        <a href={TERMS_URL} target="_blank" rel="noreferrer" className="font-black text-brand-700 underline-offset-4 hover:underline">
          Conditions Générales d'Utilisation
        </a>{' '}
        et la{' '}
        <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="font-black text-brand-700 underline-offset-4 hover:underline">
          Politique de confidentialité
        </a>{' '}
        de Samay Këur.
      </span>
    </label>
  );
}
