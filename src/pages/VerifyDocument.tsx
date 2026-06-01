import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { DocumentVerificationResultCard } from '../components/documents/DocumentVerificationResultCard';
import {
  getVerificationQueryParams,
  type DocumentVerificationResult,
  verifyDocumentToken,
} from '../services/documentVerification';

const MARKETING_URL = (import.meta.env.VITE_MARKETING_URL as string | undefined) || 'https://samaykeur.com';

export function VerifyDocument() {
  const { token, ref, type } = useMemo(getVerificationQueryParams, []);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<DocumentVerificationResult | null>(null);

  const runVerification = useCallback(async () => {
    setLoading(true);
    try {
      const next = await verifyDocumentToken(token, { reference: ref, type });
      if (next.state === 'invalid' && ref) {
        setResult({
          state: 'invalid',
          message: `La référence ${ref}${type ? ` (${type})` : ''} est visible, mais le jeton sécurisé du QR est absent ou invalide.`,
        });
      } else {
        setResult(next);
      }
    } finally {
      setLoading(false);
    }
  }, [ref, token, type]);

  useEffect(() => {
    void runVerification();
  }, [runVerification]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#06130f] px-4 py-6 text-white sm:py-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.36),transparent_34rem),radial-gradient(circle_at_88%_18%,rgba(245,158,11,0.18),transparent_22rem),linear-gradient(135deg,rgba(2,44,34,0.95),rgba(6,19,15,1))]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col justify-center">
        <div className="mb-5 flex items-center justify-between gap-3">
          <a
            href={MARKETING_URL}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-black uppercase tracking-[0.13em] text-emerald-50/75 transition hover:bg-white/[0.12]"
          >
            <ArrowLeft className="h-4 w-4" />
            Accueil
          </a>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/15 bg-emerald-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.13em] text-emerald-100">
            <ShieldCheck className="h-4 w-4" />
            Vérification QR
          </div>
        </div>

        <DocumentVerificationResultCard
          result={result}
          loading={loading}
          onRetry={runVerification}
          onDiscover={() => {
            window.location.href = MARKETING_URL;
          }}
        />
      </div>
    </main>
  );
}
