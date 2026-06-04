import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
  Home,
  Loader2,
  ReceiptText,
  Sparkles,
  UserRound,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { DemoDataLoader } from '../billing/DemoDataLoader';

interface FirstStepsChecklistProps {
  onNavigate?: (page: string) => void;
  onStartWizard?: () => void;
  onDemoLoaded?: () => void;
  showDemoData?: boolean;
}

interface ProgressCounts {
  immeubles: number;
  locataires: number;
  paiements: number;
  quittances: number;
}

const DEFAULT_COUNTS: ProgressCounts = {
  immeubles: 0,
  locataires: 0,
  paiements: 0,
  quittances: 0,
};

export function FirstStepsChecklist({
  onNavigate,
  onStartWizard,
  onDemoLoaded,
  showDemoData = false,
}: FirstStepsChecklistProps) {
  const { profile, accountProfile } = useAuth();
  const [counts, setCounts] = useState<ProgressCounts>(DEFAULT_COUNTS);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const loadProgress = useCallback(async () => {
    if (!profile?.agency_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const agencyId = profile.agency_id;
      const [immeublesRes, locatairesRes, paiementsRes, quittancesRes] = await Promise.all([
        supabase.from('immeubles').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId),
        supabase.from('locataires').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId),
        supabase.from('paiements').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId),
        supabase
          .from('document_registry')
          .select('id', { count: 'exact', head: true })
          .eq('agency_id', agencyId)
          .eq('document_type', 'quittance')
          .eq('status', 'active'),
      ]);

      setCounts({
        immeubles: immeublesRes.count ?? 0,
        locataires: locatairesRes.count ?? 0,
        paiements: paiementsRes.count ?? 0,
        quittances: quittancesRes.error ? 0 : quittancesRes.count ?? 0,
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.agency_id]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  const steps = useMemo(
    () => [
      {
        id: 'immeuble',
        title: 'Creer un immeuble',
        description: 'Posez le premier bien de votre portefeuille.',
        completed: counts.immeubles > 0,
        icon: Building2,
        actionLabel: 'Ajouter',
        action: () => onNavigate?.('immeubles'),
      },
      {
        id: 'locataire',
        title: 'Ajouter un locataire',
        description: 'Rattachez une personne au suivi de location.',
        completed: counts.locataires > 0,
        icon: UserRound,
        actionLabel: 'Ajouter',
        action: () => onNavigate?.('locataires'),
      },
      {
        id: 'paiement',
        title: 'Enregistrer un paiement',
        description: 'Voyez tout de suite ce qui est paye ou partiel.',
        completed: counts.paiements > 0,
        icon: ReceiptText,
        actionLabel: 'Encaisser',
        action: () => onNavigate?.('paiements'),
      },
      {
        id: 'quittance',
        title: 'Generer une quittance',
        description: 'Transformez un paiement en document propre.',
        completed: counts.quittances > 0,
        icon: FileText,
        actionLabel: 'Ouvrir',
        action: () => onNavigate?.('paiements'),
      },
    ],
    [counts, onNavigate],
  );

  const completedCount = steps.filter((step) => step.completed).length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const isComplete = completedCount === steps.length;
  if (loading) {
    return (
      <div className="sk-premium-panel p-6">
        <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-brand-800" />
          Preparation du guide de premiers pas...
        </div>
      </div>
    );
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="sk-premium-panel flex w-full items-center justify-between gap-4 p-4 text-left transition hover:-translate-y-0.5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-brand-800">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-black text-slate-950">Premiers pas</p>
            <p className="text-sm font-semibold text-slate-500">{completedCount}/{steps.length} actions terminees</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-400" />
      </button>
    );
  }

  return (
    <section className="sk-premium-panel overflow-hidden">
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-5 text-white sm:p-6">
        {isComplete && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 14 }).map((_, index) => (
              <span
                key={index}
                className="absolute h-1.5 w-1.5 rounded-full bg-orange-300 opacity-80"
                style={{
                  left: `${8 + ((index * 7) % 86)}%`,
                  top: `${12 + ((index * 13) % 72)}%`,
                }}
              />
            ))}
          </div>
        )}
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/25 bg-orange-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-orange-200">
              <Home className="h-3.5 w-3.5" />
              Mise en route
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
              Votre premiere victoire, pas un tableau vide.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/72">
              Suivez ces actions simples ou chargez des donnees exemples pour explorer l'application tout de suite.
            </p>
          </div>

          <div className="min-w-[12rem]">
            <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.14em] text-emerald-100/70">
              <span>Progression</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-orange-300 transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              type="button"
              onClick={step.action}
              className={`group flex items-center gap-4 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                step.completed
                  ? 'border-emerald-200 bg-emerald-50/75'
                  : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/40'
              }`}
            >
              <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${
                step.completed ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-orange-100 group-hover:text-orange-700'
              }`}>
                {step.completed ? <CheckCircle2 className="h-6 w-6" /> : <Icon className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`font-black ${step.completed ? 'text-emerald-950' : 'text-slate-950'}`}>{step.title}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">{step.description}</p>
              </div>
              <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-600 sm:inline-flex">
                {step.completed ? 'Fait' : step.actionLabel}
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-slate-100 p-4 sm:p-5">
        {showDemoData ? (
          <DemoDataLoader
            onLoaded={() => {
              void loadProgress();
              onDemoLoaded?.();
            }}
          />
        ) : isComplete ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="font-black text-emerald-950">
              {accountProfile.isIndividualOwner ? 'Espace propriétaire prêt.' : 'Agence prête à être présentée.'}
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-700">
              Vos premiers biens, paiements et documents donnent maintenant de la matiere au dashboard.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold leading-6 text-slate-600">
              {accountProfile.isIndividualOwner
                ? 'Vous pouvez aussi finaliser votre identité propriétaire avant de saisir les données métier.'
                : "Vous pouvez aussi finaliser l'identité de l'agence avant de saisir les données métier."}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onStartWizard}
                className="rounded-xl border border-emerald-900/10 bg-white px-4 py-2.5 text-sm font-black text-brand-800 shadow-sm transition hover:bg-emerald-50"
              >
                {accountProfile.isIndividualOwner ? 'Configurer mon compte' : "Configurer l'agence"}
              </button>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="rounded-xl px-4 py-2.5 text-sm font-black text-slate-500 transition hover:bg-slate-50"
              >
                Reduire
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
