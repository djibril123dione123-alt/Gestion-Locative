import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Landmark,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { WizardShell, type WizardStep } from '../ui/WizardShell';
import { BrandMark } from '../brand/BrandLogo';
import { Button } from '../ui/Button';
import { SmartCombobox, type SmartComboboxOption } from '../ui/SmartCombobox';
import { MoneyText } from '../ui/MoneyText';
import { formatPersonName } from '../../lib/people';

export interface DepenseImmeubleOption {
  id: string;
  nom: string;
  bailleurs?: { id: string; nom: string; prenom: string } | null;
}

export interface DepenseFormData {
  montant: string;
  date_depense: string;
  categorie: string;
  description: string;
  beneficiaire: string;
  immeuble_id: string;
  piece_justificative: string;
  affectation: 'agence' | 'bien';
}

interface DepenseFormModalProps {
  isOpen: boolean;
  editing: boolean;
  formData: DepenseFormData;
  setFormData: React.Dispatch<React.SetStateAction<DepenseFormData>>;
  immeubles: DepenseImmeubleOption[];
  isSaving: boolean;
  originalAmount?: number | null;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}

const EXPENSE_STEPS: WizardStep[] = [
  { id: 1, label: 'Nature', description: 'Montant et motif' },
  { id: 2, label: 'Affectation', description: 'Agence ou bien' },
  { id: 3, label: 'Validation', description: 'Justificatif et impact' },
];

const BASE_CATEGORIES = [
  'Maintenance',
  'Électricité',
  'Eau',
  'Salaires',
  'Transport',
  'Télécommunications',
  'Internet',
  'Autres',
];

export function DepenseFormModal({
  isOpen,
  editing,
  formData,
  setFormData,
  immeubles,
  isSaving,
  originalAmount,
  onClose,
  onSubmit,
}: DepenseFormModalProps) {
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (isOpen) setCurrentStep(1);
  }, [editing, isOpen]);

  const amount = Number(formData.montant || 0);
  const selectedImmeuble = immeubles.find((immeuble) => immeuble.id === formData.immeuble_id);
  const ownerLabel = selectedImmeuble?.bailleurs
    ? formatPersonName(selectedImmeuble.bailleurs, 'Bailleur non renseigné')
    : 'Bailleur non renseigné';
  const stepOneValid = Number.isFinite(amount)
    && amount > 0
    && Boolean(formData.date_depense && formData.categorie.trim());
  const stepTwoValid = formData.affectation === 'agence' || Boolean(formData.immeuble_id);
  const canSubmit = stepOneValid && stepTwoValid && !isSaving;

  const categoryOptions: SmartComboboxOption[] = useMemo(() => {
    const categories = formData.categorie && !BASE_CATEGORIES.includes(formData.categorie)
      ? [formData.categorie, ...BASE_CATEGORIES]
      : BASE_CATEGORIES;
    return categories.map((category) => ({ value: category, label: category }));
  }, [formData.categorie]);

  const propertyOptions: SmartComboboxOption[] = immeubles.map((immeuble) => ({
    value: immeuble.id,
    label: immeuble.nom,
    subtitle: immeuble.bailleurs ? formatPersonName(immeuble.bailleurs) : 'Bailleur non renseigné',
    keywords: `${immeuble.nom} ${immeuble.bailleurs ? formatPersonName(immeuble.bailleurs) : ''}`,
  }));

  return (
    <WizardShell
      open={isOpen}
      onClose={() => {
        if (!isSaving) onClose();
      }}
      size="standard"
      variant="workstation"
      tone="finance"
      eyebrow="CHARGES & EXPLOITATION"
      title={editing ? 'Modifier la dépense' : 'Nouvelle dépense'}
      description="Qualifiez la charge, son affectation et sa preuve avant validation."
      steps={EXPENSE_STEPS}
      currentStep={currentStep - 1}
      contentDescription="Qualifiez la charge, son affectation et sa preuve avant validation."
      stepContext={<DepenseWizardStepContext step={currentStep} editing={editing} />}
      rail={
        <DepenseWizardRail
          steps={EXPENSE_STEPS}
          currentStep={currentStep - 1}
        />
      }
      secondaryAction={
        <Button
          type="button"
          variant="secondary"
          onClick={() => currentStep === 1 ? onClose() : setCurrentStep((step) => step - 1)}
          disabled={isSaving}
        >
          {currentStep === 1 ? 'Annuler' : <><ChevronLeft className="h-4 w-4" /> Retour</>}
        </Button>
      }
      primaryAction={
        currentStep < 3 ? (
          <Button
            type="button"
            onClick={() => setCurrentStep((step) => step + 1)}
            disabled={currentStep === 1 ? !stepOneValid : !stepTwoValid}
          >
            Continuer <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" onClick={() => void onSubmit()} loading={isSaving} disabled={!canSubmit}>
            {editing ? 'Modifier la dépense' : 'Enregistrer la dépense'}
          </Button>
        )
      }
    >
      <form onSubmit={(event) => event.preventDefault()} className="space-y-3 pb-[max(0.25rem,env(safe-area-inset-bottom))]">

        {currentStep === 1 && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="depense-montant" className="mb-1.5 block text-[0.75rem] font-bold uppercase tracking-wider text-slate-700">Montant <span className="text-red-600">*</span></label>
                <input
                  id="depense-montant"
                  title="Montant de la dépense"
                  placeholder="0"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  required
                  value={formData.montant}
                  onChange={(event) => setFormData((previous) => ({ ...previous, montant: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-extrabold tabular-nums text-slate-950 shadow-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
                />
              </div>
              <div>
                <label htmlFor="depense-date" className="mb-1.5 block text-[0.75rem] font-bold uppercase tracking-wider text-slate-700">Date <span className="text-red-600">*</span></label>
                <input
                  id="depense-date"
                  title="Date de la dépense"
                  type="date"
                  required
                  value={formData.date_depense}
                  onChange={(event) => setFormData((previous) => ({ ...previous, date_depense: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[0.75rem] font-bold uppercase tracking-wider text-slate-700">Catégorie <span className="text-red-600">*</span></label>
              <SmartCombobox
                value={formData.categorie}
                options={categoryOptions}
                onChange={(value) => setFormData((previous) => ({ ...previous, categorie: value }))}
                placeholder="Sélectionner une catégorie"
                searchPlaceholder="Maintenance, eau, transport…"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[0.75rem] font-bold uppercase tracking-wider text-slate-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(event) => setFormData((previous) => ({ ...previous, description: event.target.value }))}
                placeholder="Objet de la dépense, intervention ou période concernée"
                rows={2}
                className="min-h-[3.5rem] w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
              />
            </div>
            {!stepOneValid && (
              <p className="text-xs font-semibold text-amber-700" role="status">
                Renseignez un montant supérieur à 0 F CFA, une date et une catégorie pour continuer.
              </p>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-[0.75rem] font-bold uppercase tracking-wider text-slate-700">À qui cette dépense est-elle affectée ?</p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setFormData((previous) => ({ ...previous, affectation: 'agence', immeuble_id: '' }))}
                  className={`flex min-h-16 items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${
                    formData.affectation === 'agence'
                      ? 'border-emerald-700 bg-emerald-50 ring-2 ring-emerald-700/10'
                      : 'border-slate-200 bg-white hover:border-emerald-200'
                  }`}
                >
                  <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                  <span>
                    <span className="block text-xs font-bold text-slate-950">Dépense agence</span>
                    <span className="mt-0.5 block text-[11px] font-medium leading-4 text-slate-500">Charge générale non rattachée à un bien.</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((previous) => ({ ...previous, affectation: 'bien' }))}
                  className={`flex min-h-16 items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${
                    formData.affectation === 'bien'
                      ? 'border-emerald-700 bg-emerald-50 ring-2 ring-emerald-700/10'
                      : 'border-slate-200 bg-white hover:border-emerald-200'
                  }`}
                >
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                  <span>
                    <span className="block text-xs font-bold text-slate-950">Dépense bailleur / bien</span>
                    <span className="mt-0.5 block text-[11px] font-medium leading-4 text-slate-500">Charge liée à un bien selon la règle métier.</span>
                  </span>
                </button>
              </div>
            </div>

            {formData.affectation === 'bien' && (
              <div>
                <label className="mb-1.5 block text-[0.75rem] font-bold uppercase tracking-wider text-slate-700">Bien concerné <span className="text-red-600">*</span></label>
                <SmartCombobox
                  value={formData.immeuble_id}
                  options={propertyOptions}
                  onChange={(value) => setFormData((previous) => ({ ...previous, immeuble_id: value }))}
                  placeholder="Sélectionner un bien"
                  searchPlaceholder="Bien ou bailleur"
                  emptyLabel="Aucun bien actif disponible."
                />
                {selectedImmeuble && (
                  <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50 p-2.5">
                    <UserRound className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-emerald-700">Bailleur associé</p>
                      <p className="text-xs font-bold text-emerald-950">{ownerLabel}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[0.75rem] font-bold uppercase tracking-wider text-slate-700">Bénéficiaire</label>
              <input
                type="text"
                value={formData.beneficiaire}
                onChange={(event) => setFormData((previous) => ({ ...previous, beneficiaire: event.target.value }))}
                placeholder="Prestataire, fournisseur ou collaborateur"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
              />
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-3">
            {editing && originalAmount != null && (
              <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-900">Valeur actuelle → nouvelle valeur</p>
                <div className="mt-2 grid grid-cols-2 gap-2.5">
                  <div className="rounded-lg bg-white p-2.5 ring-1 ring-amber-200">
                    <p className="text-[9px] font-black uppercase text-slate-500">Avant</p>
                    <p className="mt-0.5 text-sm font-black text-slate-950"><MoneyText value={originalAmount} /></p>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 ring-1 ring-emerald-200">
                    <p className="text-[9px] font-black uppercase text-slate-500">Après</p>
                    <p className="mt-0.5 text-sm font-black text-emerald-800"><MoneyText value={amount} /></p>
                  </div>
                </div>
              </section>
            )}

            <div>
              <label className="mb-1.5 block text-[0.75rem] font-bold uppercase tracking-wider text-slate-700">Lien du justificatif</label>
              <input
                type="url"
                value={formData.piece_justificative}
                onChange={(event) => setFormData((previous) => ({ ...previous, piece_justificative: event.target.value }))}
                placeholder="https://… (facultatif)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
              />
              <p className="mt-1 text-[11px] font-medium text-slate-500">Ajoutez un lien sécurisé existant. Aucun fichier n’est téléversé silencieusement.</p>
            </div>

            <section className="rounded-xl border border-emerald-950/10 bg-white p-3 shadow-sm">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">Résumé financier</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">Vérifiez l’affectation avant l’enregistrement.</p>
                </div>
                <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.1em] text-emerald-700">Montant</p>
                  <p className="mt-0.5 text-sm font-extrabold text-emerald-950"><MoneyText value={amount} /></p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">Date</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-950">
                    {formData.date_depense ? new Date(`${formData.date_depense}T00:00:00`).toLocaleDateString('fr-FR') : '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">À la charge de</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-950">{formData.affectation === 'bien' ? ownerLabel : 'Agence'}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">Catégorie</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-950">{formData.categorie || '—'}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">Affectation</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-950">{selectedImmeuble?.nom || 'Dépense générale'}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">Bénéficiaire</p>
                  <p className="mt-0.5 truncate text-xs font-bold text-slate-950">{formData.beneficiaire.trim() || 'Non renseigné'}</p>
                </div>
              </div>
              <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5">
                <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">Description</p>
                <p className="mt-0.5 text-xs font-semibold leading-4 text-slate-700">{formData.description.trim() || 'Aucune description ajoutée.'}</p>
              </div>
              <div className="mt-2.5 flex items-start gap-2.5 rounded-lg border border-emerald-100 bg-[#fffdf8] p-2.5">
                {formData.piece_justificative ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                ) : (
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                )}
                <div>
                  <p className="text-sm font-black text-slate-950">{formData.piece_justificative ? 'Justificatif référencé' : 'Aucun justificatif'}</p>
                  <p className="mt-1 break-all text-xs font-semibold leading-5 text-slate-500">
                    {formData.piece_justificative
                      ? formData.piece_justificative
                      : 'Aucun justificatif ajouté. La dépense peut être enregistrée, mais un justificatif renforce la traçabilité.'}
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-semibold leading-5 text-emerald-950">
                Impact financier : cette charge sera enregistrée dans le suivi {formData.affectation === 'bien' ? 'du bien et du bailleur associés' : 'de l’agence'} par le workflow sécurisé existant.
              </div>
            </section>
          </div>
        )}
      </form>
    </WizardShell>
  );
}

function DepenseWizardRail({ steps, currentStep }: { steps: WizardStep[]; currentStep: number }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2.5">
        <BrandMark size="sm" tone="dark" animated withTile={false} />
        <div>
          <p className="text-[0.5rem] font-bold uppercase tracking-[0.18em] text-emerald-200/80">Charges & Exploitation</p>
          <p className="mt-0.5 text-[0.6rem] font-semibold text-white/[0.56]">Dépense guidée</p>
        </div>
      </div>

      <div className="mt-3">
        <p className="max-w-[11rem] text-[0.72rem] font-semibold leading-tight text-white/[0.86]">
          Maîtrisez vos charges.
        </p>
        <p className="mt-1 max-w-[11rem] text-[0.6rem] font-medium leading-snug text-emerald-50/[0.56]">
          Imputation directe agence ou bien, traçabilité des pièces et calcul du résultat pur.
        </p>
      </div>

      <div className="relative mt-3 space-y-1">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isComplete = index < currentStep;

          return (
            <div
              key={step.id}
              className={`flex min-h-[2.05rem] items-center gap-2 rounded-lg border px-2 py-[0.22rem] transition ${
                isActive
                  ? 'border-emerald-300/25 bg-white/[0.055] text-white shadow-[0_3px_8px_rgba(0,0,0,0.036)]'
                  : isComplete
                    ? 'border-white/10 bg-emerald-400/[0.045] text-emerald-50/[0.78]'
                    : 'border-white/[0.075] bg-white/[0.018] text-emerald-50/[0.78]'
              }`}
            >
              <span
                className={`relative z-[1] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[0.5rem] text-[0.58rem] font-semibold ${
                  isActive
                    ? 'bg-[#d1fae5]/94 text-emerald-950 ring-1 ring-emerald-200/60'
                    : isComplete
                      ? 'bg-emerald-300/[0.15] text-emerald-50'
                      : 'bg-white/[0.1] text-emerald-50/[0.84]'
                }`}
              >
                {isComplete ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.47rem] font-bold uppercase tracking-[0.13em] opacity-75">
                  Étape {index + 1}
                </span>
                <span className="block truncate text-[0.67rem] font-semibold">{step.label}</span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-white/[0.055] bg-white/[0.026] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
        <p className="text-[0.47rem] font-semibold uppercase tracking-[0.16em] text-cyan-200/[0.75]">SOURCE DE VÉRITÉ</p>
        <p className="mt-1 text-[0.58rem] font-medium leading-snug text-emerald-50/[0.56]">
          Impacte immédiatement le compte d'exploitation de l'agence ou le reversement net du bailleur.
        </p>
      </div>
    </div>
  );
}

function DepenseWizardStepContext({ step, editing }: { step: number; editing: boolean }) {
  const copy: Record<number, { title?: string; body: string }> = {
    1: {
      title: 'Qualification de la charge',
      body: 'Définissez la nature de la dépense, le montant TTC et le prestataire bénéficiaire pour catégoriser la charge.',
    },
    2: {
      title: 'Affectation et imputation',
      body: 'Indiquez si la charge est supportée par l’agence (frais généraux) ou imputable sur le compte d’un immeuble/bailleur.',
    },
    3: {
      title: editing ? 'Validation des modifications' : 'Validation et justificatif',
      body: 'Référencez la pièce justificative (facture, reçu) et vérifiez les paramètres d’imputation avant enregistrement.',
    },
  };
  const current = copy[step] || copy[1];

  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-[0.1rem] flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border border-emerald-950/10 bg-emerald-50/60 text-emerald-700 sm:h-[18px] sm:w-[18px]">
        <ShieldAlert className="h-2.5 w-2.5" />
      </span>
      <div className="min-w-0">
        {current.title && (
          <p className="text-[0.68rem] font-semibold leading-tight text-slate-900 sm:text-[0.64rem]">
            {current.title}
          </p>
        )}
        <p className="min-w-0 text-[0.72rem] font-medium leading-snug text-slate-600 sm:text-[0.66rem]">
          {current.body}
        </p>
      </div>
    </div>
  );
}

