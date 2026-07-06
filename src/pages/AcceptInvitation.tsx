import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { reloadUserProfile } from '../lib/agencyHelper';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

type Status = 'loading' | 'awaiting_auth' | 'success' | 'error' | 'expired';

interface Props {
  token: string;
  onDone: () => void;
}

interface InvitationInfo {
  found: boolean;
  reason?: string;
  id?: string;
  email?: string;
  role?: string;
  status?: 'pending' | 'accepted' | 'expired';
  agency_id?: string;
  agency_name?: string;
  expires_at?: string;
  expired?: boolean;
}

const SESSION_KEY = 'invite_token';

function clearStoredToken() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
}

function storeToken(token: string) {
  try {
    sessionStorage.setItem(SESSION_KEY, token);
  } catch {
    /* noop */
  }
}

export function AcceptInvitation({ token, onDone }: Props) {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState<string>('');
  const [agencyName, setAgencyName] = useState<string>('');
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        // 1) Lecture sanitisée de l'invitation via RPC SECURITY DEFINER
        //    (fonctionne même non authentifié)
        const { data, error } = await supabase.rpc('get_invitation_by_token', { p_token: token });
        if (cancelled) return;

        if (error) {
          setStatus('error');
          setMessage('Impossible de vérifier l\'invitation. Veuillez réessayer.');
          return;
        }

        const info = (data ?? {}) as InvitationInfo;

        if (!info.found) {
          setStatus('error');
          setMessage('Cette invitation est introuvable ou a déjà été utilisée.');
          clearStoredToken();
          return;
        }

        if (info.status === 'accepted') {
          setStatus('error');
          setMessage('Cette invitation a déjà été acceptée.');
          clearStoredToken();
          return;
        }

        if (info.expired || info.status === 'expired') {
          setStatus('expired');
          setMessage('Cette invitation a expiré.');
          clearStoredToken();
          return;
        }

        setAgencyName(info.agency_name ?? 'l\'agence');
        setRole(info.role ?? '');

        if (!user) {
          // Conserver le token pour la suite (post-login)
          storeToken(token);
          setStatus('awaiting_auth');
          return;
        }

        // 2) L'utilisateur est connecté → acceptation via RPC SECURITY DEFINER
        const { data: acceptData, error: acceptError } = await supabase.rpc('accept_invitation', { p_token: token });
        if (cancelled) return;

        if (acceptError) {
          setStatus('error');
          setMessage(acceptError.message || 'Erreur lors de l\'acceptation de l\'invitation.');
          return;
        }

        const result = (acceptData ?? {}) as { agency_id?: string; agency_name?: string; role?: string };

        // Recharger le profil pour récupérer agency_id + role à jour côté front
        await reloadUserProfile();
        clearStoredToken();

        setStatus('success');
        setMessage(
          `Vous avez rejoint ${result.agency_name || agencyName} en tant que ${result.role || role}.`,
        );
      } catch (err: unknown) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Erreur lors de l\'acceptation');
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [token, user, agencyName, role]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-paper p-4">
      <div className="w-full max-w-xs rounded-xl border border-emerald-950/10 bg-white/88 p-4 text-center shadow-[0_14px_40px_rgba(6,17,13,0.1)]">
        {status === 'loading' && (
          <>
            <Loader2 className="mx-auto mb-2 h-7 w-7 animate-spin" style={{ color: '#F58220' }} />
            <p className="text-sm font-semibold text-slate-700">Vérification de l'invitation…</p>
          </>
        )}
        {status === 'awaiting_auth' && (
          <>
            <Loader2 className="mx-auto mb-2 h-7 w-7" style={{ color: '#F58220' }} />
            <h1 className="mb-1.5 text-base font-bold text-slate-900">Invitation valide</h1>
            <p className="mb-3 text-xs text-slate-600">
              Vous êtes invité à rejoindre <span className="font-semibold">{agencyName}</span> en tant que{' '}
              <span className="font-semibold capitalize">{role}</span>.
            </p>
            <p className="mb-4 text-xs text-slate-500">
              Connectez-vous ou créez votre compte pour accepter.
            </p>
            <button
              type="button"
              onClick={onDone}
              data-testid="button-go-to-auth"
              className="rounded-lg px-4 py-2.5 text-xs font-bold text-white"
              style={{ backgroundColor: '#F58220' }}
            >
              Se connecter / S'inscrire
            </button>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-green-600" />
            <h1 className="mb-1.5 text-base font-bold text-slate-900">Bienvenue !</h1>
            <p className="mb-3 text-xs text-slate-600">{message}</p>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              data-testid="button-enter-app"
              className="rounded-lg px-4 py-2.5 text-xs font-bold text-white"
              style={{ backgroundColor: '#F58220' }}
            >
              Accéder à l'application
            </button>
          </>
        )}
        {(status === 'error' || status === 'expired') && (
          <>
            <XCircle className="mx-auto mb-2 h-7 w-7 text-red-600" />
            <h1 className="mb-1.5 text-base font-bold text-slate-900">Invitation invalide</h1>
            <p className="mb-3 text-xs text-slate-600">{message}</p>
            <button
              type="button"
              onClick={() => { clearStoredToken(); onDone(); }}
              className="rounded-lg px-4 py-2.5 text-xs font-bold text-white"
              style={{ backgroundColor: '#F58220' }}
            >
              Continuer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
