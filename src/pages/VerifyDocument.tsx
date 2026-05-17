import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileCheck2, Loader2, ShieldCheck } from 'lucide-react';
import { BrandMark } from '../components/brand/BrandLogo';
import { formatCurrency } from '../lib/formatters';

type VerificationResponse = {
  valid: boolean;
  status?: 'authentic' | 'revoked' | 'superseded';
  error?: string;
  document?: {
    reference: string;
    type: string;
    agency: string;
    issued_at: string;
    amount_xof?: number | null;
    payment_status?: string | null;
    registered_at?: string | null;
  };
};

function getVerificationParams() {
  const hashQuery = window.location.hash.includes('?')
    ? window.location.hash.slice(window.location.hash.indexOf('?') + 1)
    : '';
  const params = new URLSearchParams(hashQuery || window.location.search);
  return {
    token: params.get('token') ?? '',
    ref: params.get('ref') ?? '',
    type: params.get('type') ?? '',
  };
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  });
}

export function VerifyDocument() {
  const { token, ref, type } = useMemo(getVerificationParams, []);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerificationResponse | null>(null);

  useEffect(() => {
    let alive = true;
    const verify = async () => {
      if (!/^[a-f0-9]{64}$/i.test(token)) {
        setResult({ valid: false, error: 'Lien de vérification incomplet ou invalide.' });
        setLoading(false);
        return;
      }

      try {
        const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
        if (!baseUrl || !anonKey) {
          throw new Error('Configuration de vérification absente');
        }

        const response = await fetch(`${baseUrl}/functions/v1/verify-document?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: {
            apikey: anonKey,
          },
        });
        const data = await response.json() as VerificationResponse;
        if (!alive) return;
        setResult(data);
      } catch {
        if (!alive) return;
        setResult({
          valid: false,
          error: 'Le service de vérification est momentanément indisponible.',
        });
      } finally {
        if (alive) setLoading(false);
      }
    };

    void verify();
    return () => {
      alive = false;
    };
  }, [token]);

  const isAuthentic = Boolean(result?.valid && result.document);
  const document = result?.document;
  const statusLabel = result?.status === 'revoked'
    ? 'Document révoqué'
    : result?.status === 'superseded'
      ? 'Document remplacé'
      : isAuthentic
        ? 'Document authentique'
        : 'Document introuvable';

  return (
    <main className="min-h-screen bg-[#06130f] px-4 py-8 text-white sm:py-12">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(22,101,52,0.42),transparent_34rem),radial-gradient(circle_at_88%_18%,rgba(249,115,22,0.18),transparent_22rem)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.075] p-5 shadow-2xl shadow-black/35 backdrop-blur-2xl sm:p-8">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div className="flex items-center gap-3">
              <BrandMark size="md" tone="dark" animated />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100/55">
                  Samay Këur
                </p>
                <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                  Vérification du document
                </h1>
              </div>
            </div>
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${
              loading
                ? 'bg-white/10 text-emerald-100 ring-white/10'
                : isAuthentic
                  ? 'bg-emerald-400/15 text-emerald-100 ring-emerald-300/25'
                  : 'bg-red-400/15 text-red-100 ring-red-300/25'
            }`}>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isAuthentic ? (
                <ShieldCheck className="h-6 w-6" />
              ) : (
                <AlertTriangle className="h-6 w-6" />
              )}
            </div>
          </div>

          <div className="py-8 text-center">
            <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ${
              loading
                ? 'bg-white/10 text-emerald-100 ring-white/10'
                : isAuthentic
                  ? 'bg-emerald-400/15 text-emerald-100 ring-emerald-300/25'
                  : 'bg-red-400/15 text-red-100 ring-red-300/25'
            }`}>
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : isAuthentic ? (
                <CheckCircle2 className="h-8 w-8" />
              ) : (
                <FileCheck2 className="h-8 w-8" />
              )}
            </div>
            <p className={`text-xs font-black uppercase tracking-[0.24em] ${
              isAuthentic ? 'text-emerald-200' : 'text-orange-200'
            }`}>
              {loading ? 'Contrôle en cours' : statusLabel}
            </p>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-emerald-50/72">
              {loading
                ? 'Nous vérifions ce document auprès du registre sécurisé Samay Këur.'
                : isAuthentic
                  ? 'Ce document correspond à un enregistrement valide du registre de vérification documentaire.'
                  : result?.error ?? 'Aucun document valide ne correspond à ce jeton de vérification.'}
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-emerald-100/65">Statut</span>
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-black ${
                isAuthentic ? 'bg-emerald-400/15 text-emerald-100' : 'bg-red-400/15 text-red-100'
              }`}>
                {isAuthentic ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {statusLabel}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-emerald-100/65">Référence</span>
              <span className="min-w-0 truncate font-black text-white">{document?.reference ?? ref ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-emerald-100/65">Type</span>
              <span className="font-black capitalize text-white">{document?.type ?? type ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-emerald-100/65">Agence émettrice</span>
              <span className="min-w-0 truncate font-black text-white">{document?.agency ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-emerald-100/65">Date d’émission</span>
              <span className="font-black text-white">{formatDate(document?.issued_at)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-emerald-100/65">Montant</span>
              <span className="font-black text-white">
                {document?.amount_xof != null ? formatCurrency(Number(document.amount_xof), 'XOF') : '—'}
              </span>
            </div>
            {document?.payment_status && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-emerald-100/65">État paiement</span>
                <span className="font-black text-white">{document.payment_status}</span>
              </div>
            )}
          </div>

          <p className="mt-5 text-center text-xs leading-5 text-emerald-50/45">
            Cette page confirme uniquement l’authenticité du document enregistré. En cas de doute,
            contactez directement l’agence émettrice.
          </p>
        </section>
      </div>
    </main>
  );
}
