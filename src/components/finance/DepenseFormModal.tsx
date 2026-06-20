import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Landmark,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SmartCombobox, type SmartComboboxOption } from '../ui/SmartCombobox';
import { MoneyText } from '../ui/MoneyText';
import { FinanceWizardStepper } from './FinanceWizardStepper';
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

const EXPENSE_STEPS = [
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
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSaving) onClose();
      }}
      title={editing ? 'Modifier la dépense' : 'Nouvelle dépense'}
      description="Qualifiez la charge, son affectation et sa preuve avant validation."
    >
      <form onSubmit={(event) => event.preventDefault()} className="space-y-3 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        <FinanceWizardStepper currentStep={currentStep} steps={EXPENSE_STEPS} />

        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-4 text-white shadow-lg shadow-emerald-950/15">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-orange-200 ring-1 ring-white/15">
                  <ReceiptText className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200">Charge maîtrisée</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-50/80">Décrivez la dépense telle qu’elle doit apparaître dans l’historique.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-black text-slate-800">Montant <span className="text-red-600">*</span></label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  required
                  value={formData.montant}
                  onChange={(event) => setFormData((previous) => ({ ...previous, montant: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-black text-slate-800">Date <span className="text-red-600">*</span></label>
                <input
                  type="date"
                  required
                  value={formData.date_depense}
                  onChange={(event) => setFormData((previous) => ({ ...previous, date_depense: event.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-slate-800">Catégorie <span className="text-red-600">*</span></label>
              <SmartCombobox
                value={formData.categorie}
                options={categoryOptions}
                onChange={(value) => setFormData((previous) => ({ ...previous, categorie: value }))}
                placeholder="Sélectionner une catégorie"
                searchPlaceholder="Maintenance, eau, transport…"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-slate-800">Description</label>
              <textarea
                value={formData.description}
                onChange={(event) => setFormData((previous) => ({ ...previous, description: event.target.value }))}
                placeholder="Objet de la dépense, intervention ou période concernée"
                rows={2}
                className="min-h-[4.5rem]"
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
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-black text-slate-800">À qui cette dépense est-elle affectée ?</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setFormData((previous) => ({ ...previous, affectation: 'agence', immeuble_id: '' }))}
                  className={`flex min-h-24 items-start gap-3 rounded-2xl border p-4 text-left transition ${
                    formData.affectation === 'agence'
                      ? 'border-emerald-700 bg-emerald-50 ring-2 ring-emerald-700/10'
                      : 'border-slate-200 bg-white hover:border-emerald-200'
                  }`}
                >
                  <Landmark className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-black text-slate-950">Dépense agence</span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">Charge générale non rattachée à un bien.</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((previous) => ({ ...previous, affectation: 'bien' }))}
                  className={`flex min-h-24 items-start gap-3 rounded-2xl border p-4 text-left transition ${
                    formData.affectation === 'bien'
                      ? 'border-emerald-700 bg-emerald-50 ring-2 ring-emerald-700/10'
                      : 'border-slate-200 bg-white hover:border-emerald-200'
                  }`}
                >
                  <Building2 className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-black text-slate-950">Dépense bailleur / bien</span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">Charge liée à un bien, visible dans le suivi du bien et du bailleur selon la règle métier.</span>
                  </span>
                </button>
              </div>
            </div>

            {formData.affectation === 'bien' && (
              <div>
                <label className="mb-2 block text-sm font-black text-slate-800">Bien concerné <span className="text-red-600">*</span></label>
                <SmartCombobox
                  value={formData.immeuble_id}
                  options={propertyOptions}
                  onChange={(value) => setFormData((previous) => ({ ...previous, immeuble_id: value }))}
                  placeholder="Sélectionner un bien"
                  searchPlaceholder="Bien ou bailleur"
                  emptyLabel="Aucun bien actif disponible."
                />
                {selectedImmeuble && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                    <UserRound className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700">Bailleur associé</p>
                      <p className="text-sm font-black text-emerald-950">{ownerLabel}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-black text-slate-800">Bénéficiaire</label>
              <input
                type="text"
                value={formData.beneficiaire}
                onChange={(event) => setFormData((previous) => ({ ...previous, beneficiaire: event.target.value }))}
                placeholder="Prestataire, fournisseur ou collaborateur"
              />
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            {editing && originalAmount != null && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-900">Valeur actuelle → nouvelle valeur</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white p-3 ring-1 ring-amber-200">
                    <p className="text-[10px] font-black uppercase text-slate-500">Avant</p>
                    <p className="mt-1 text-base font-black text-slate-950"><MoneyText value={originalAmount} /></p>
                  </div>
                  <div className="rounded-xl bg-white p-3 ring-1 ring-emerald-200">
                    <p className="text-[10px] font-black uppercase text-slate-500">Après</p>
                    <p className="mt-1 text-base font-black text-emerald-800"><MoneyText value={amount} /></p>
                  </div>
                </div>
              </section>
            )}

            <div>
              <label className="mb-2 block text-sm font-black text-slate-800">Lien du justificatif</label>
              <input
                type="url"
                value={formData.piece_justificative}
                onChange={(event) => setFormData((previous) => ({ ...previous, piece_justificative: event.target.value }))}
                placeholder="https://… (facultatif)"
              />
              <p className="mt-2 text-xs font-semibold text-slate-500">Ajoutez un lien sécurisé existant. Aucun fichier n’est téléversé silencieusement.</p>
            </div>

            <section className="rounded-2xl border border-emerald-950/10 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-800">Résumé financier</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Vérifiez l’affectation avant l’enregistrement.</p>
                </div>
                <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700">Montant</p>
                  <p className="mt-1 text-lg font-black text-emerald-950"><MoneyText value={amount} /></p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Date</p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {formData.date_depense ? new Date(`${formData.date_depense}T00:00:00`).toLocaleDateString('fr-FR') : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">À la charge de</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{formData.affectation === 'bien' ? ownerLabel : 'Agence'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Catégorie</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{formData.categorie || '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Affectation</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{selectedImmeuble?.nom || 'Dépense générale'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Bénéficiaire</p>
                  <p className="mt-1 truncate text-sm font-black text-slate-950">{formData.beneficiaire.trim() || 'Non renseigné'}</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Description</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-slate-700">{formData.description.trim() || 'Aucune description ajoutée.'}</p>
              </div>
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-emerald-100 bg-[#fffdf8] p-3">
                {formData.piece_justificative ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                ) : (
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
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

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-emerald-950/10 bg-white/95 px-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_28px_rgba(15,23,42,0.06)] backdrop-blur sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="secondary"
            onClick={() => currentStep === 1 ? onClose() : setCurrentStep((step) => step - 1)}
            disabled={isSaving}
          >
            {currentStep === 1 ? 'Annuler' : <><ChevronLeft className="h-4 w-4" /> Retour</>}
          </Button>
          {currentStep < 3 ? (
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
          )}
        </div>
      </form>
    </Modal>
  );
}
