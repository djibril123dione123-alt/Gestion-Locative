import { CheckCircle2, FileCheck2, ShieldCheck } from 'lucide-react';
import { BrandMark } from '../components/brand/BrandLogo';

export function VerifyDocument() {
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? window.location.search);
  const token = params.get('token') ?? '';
  const ref = params.get('ref') ?? 'Document';
  const type = params.get('type') ?? 'document';
  const isValidShape = /^[a-f0-9]{64}$/i.test(token);

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-950 to-emerald-900 px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.08] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-8">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_0%,rgba(251,146,60,0.22),transparent_28rem)]" />
          <BrandMark size="lg" tone="dark" animated className="mx-auto mb-6" />
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/25">
            {isValidShape ? <ShieldCheck className="h-9 w-9" /> : <FileCheck2 className="h-9 w-9" />}
          </div>
          <p className="text-center text-xs font-black uppercase tracking-[0.26em] text-orange-300">
            Vérification document
          </p>
          <h1 className="mt-3 text-center text-3xl font-black sm:text-4xl">
            {isValidShape ? 'Empreinte numérique reconnue' : 'Lien de vérification incomplet'}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-emerald-50/75">
            Cette page contrôle la structure du jeton d’intégrité présent dans le QR code du
            document. La validation serveur complète dépend de l’activation de la table de
            vérification documentaire côté Supabase.
          </p>

          <div className="mt-8 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-emerald-100/70">Référence</span>
              <span className="font-black text-white">{ref}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-emerald-100/70">Type</span>
              <span className="font-black capitalize text-white">{type}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-emerald-100/70">Statut</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1 font-black text-emerald-100">
                <CheckCircle2 className="h-4 w-4" />
                {isValidShape ? 'Jeton lisible' : 'À vérifier'}
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
