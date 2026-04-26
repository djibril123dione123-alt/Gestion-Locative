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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#F58220' }} />
            <p className="text-slate-700">Vérification de l'invitation…</p>
          </>
        )}
        {status === 'awaiting_auth' && (
          <>
            <Loader2 className="w-12 h-12 mx-auto mb-4" style={{ color: '#F58220' }} />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Invitation valide</h1>
            <p className="text-slate-600 mb-6">
              Vous êtes invité à rejoindre <span className="font-semibold">{agencyName}</span> en tant que{' '}
              <span className="font-semibold capitalize">{role}</span>.
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Connectez-vous ou créez votre compte pour accepter.
            </p>
            <button
              type="button"
              onClick={onDone}
              data-testid="button-go-to-auth"
              className="px-6 py-3 rounded-lg text-white font-semibold"
              style={{ backgroundColor: '#F58220' }}
            >
              Se connecter / S'inscrire
            </button>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Bienvenue !</h1>
            <p className="text-slate-600 mb-6">{message}</p>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              data-testid="button-enter-app"
              className="px-6 py-3 rounded-lg text-white font-semibold"
              style={{ backgroundColor: '#F58220' }}
            >
              Accéder à l'application
            </button>
          </>
        )}
        {(status === 'error' || status === 'expired') && (
          <>
            <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Invitation invalide</h1>
            <p className="text-slate-600 mb-6">{message}</p>
            <button
              type="button"
              onClick={() => { clearStoredToken(); onDone(); }}
              className="px-6 py-3 rounded-lg text-white font-semibold"
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
