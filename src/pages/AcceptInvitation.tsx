import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

type Status = 'loading' | 'awaiting_auth' | 'success' | 'error' | 'expired';

interface Props {
  token: string;
  onDone: () => void;
}

export function AcceptInvitation({ token, onDone }: Props) {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState<string>('');
  const [agencyName, setAgencyName] = useState<string>('');
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    const run = async () => {
      try {
        const { data: invitation, error } = await supabase
          .from('invitations')
          .select('*, agencies(name)')
          .eq('token', token)
          .maybeSingle();

        if (error || !invitation) {
          setStatus('error');
          setMessage("Cette invitation est introuvable ou a déjà été utilisée.");
          return;
        }

        if (invitation.status === 'accepted') {
          setStatus('error');
          setMessage('Cette invitation a déjà été acceptée.');
          return;
        }

        if (new Date(invitation.expires_at) < new Date()) {
          setStatus('expired');
          setMessage('Cette invitation a expiré.');
          return;
        }

        setAgencyName(invitation.agencies?.name ?? 'l\'agence');
        setRole(invitation.role);

        if (!user) {
          try {
            sessionStorage.setItem('invite_token', token);
          } catch {}
          setStatus('awaiting_auth');
          return;
        }

        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ agency_id: invitation.agency_id, role: invitation.role })
          .eq('id', user.id);
        if (updateError) throw updateError;

        await supabase.from('invitations').update({ status: 'accepted' }).eq('id', invitation.id);

        setStatus('success');
        setMessage(`Vous avez rejoint ${invitation.agencies?.name ?? 'l\'agence'} en tant que ${invitation.role}.`);
      } catch (err: unknown) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Erreur lors de l\'acceptation');
      }
    };
    run();
  }, [token, user, profile]);

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
              Vous êtes invité à rejoindre <span className="font-semibold">{agencyName}</span> en tant que <span className="font-semibold capitalize">{role}</span>.
            </p>
            <p className="text-sm text-slate-500 mb-6">Connectez-vous ou créez votre compte pour accepter.</p>
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
              onClick={onDone}
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
