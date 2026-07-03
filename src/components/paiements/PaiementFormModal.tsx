import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  Info,
  ShieldAlert,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { WizardShell, type WizardStep } from '../ui/WizardShell';
import { BrandMark } from '../brand/BrandLogo';
import { Button } from '../ui/Button';
import { SmartCombobox, type SmartComboboxOption } from '../ui/SmartCombobox';
import { TooltipHint } from '../onboarding/TooltipHint';
import { isCommissionMissing } from '../../services/domain/commissionService';
import type { ContratRow, PaiementFormData, PaiementRow, PaymentChannel } from './paiementTypes';
import { buildPaymentMonthOptions, getPaymentMonthState } from '../../services/domain/paymentSchedule';
import { formatPersonName } from '../../lib/people';
import { MoneyText } from '../ui/MoneyText';
import { formatCurrency } from '../../lib/formatters';

interface PaiementFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingPaiement: PaiementRow | null;
  formData: PaiementFormData;
  setFormData: React.Dispatch<React.SetStateAction<PaiementFormData>>;
  contrats: ContratRow[];
  paiements: PaiementRow[];
  isSaving: boolean;
  onSubmit: () => Promise<void>;
  isOnline: boolean;
}

const PAYMENT_STEPS: WizardStep[] = [
  { id: 1, label: 'Contrat', description: 'Bail et échéance' },
  { id: 2, label: 'Paiement', description: 'Montant reçu' },
  { id: 3, label: 'Validation', description: 'Impact financier' },
];

function paymentChannelToMode(channel: PaymentChannel): PaiementFormData['mode_paiement'] {
  if (channel === 'wave' || channel === 'orange_money' || channel === 'mobile_money') return 'mobile_money';
  if (channel === 'autre') return 'autre' as PaiementFormData['mode_paiement'];
  return channel;
}

function formatPaymentPeriod(monthKey: string): string {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return 'Non renseignée';
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <span className="shrink-0 font-semibold text-slate-500">{label}</span>
      <span className="min-w-0 text-right font-black text-slate-950">{value}</span>
    </div>
  );
}

export function PaiementFormModal({
  isOpen,
  onClose,
  editingPaiement,
  formData,
  setFormData,
  contrats,
  paiements,
  isSaving,
  onSubmit,
  isOnline,
}: PaiementFormModalProps) {
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (isOpen) setCurrentStep(1);
  }, [editingPaiement?.id, isOpen]);

  const selectedContrat = contrats.find((contrat) => contrat.id === formData.contrat_id);
  const monthOptions = useMemo(
    () =>
      buildPaymentMonthOptions(selectedContrat, paiements, {
        excludePaymentId: editingPaiement?.id,
        selectedMonth: formData.mois_display,
      }),
    [editingPaiement?.id, formData.mois_display, paiements, selectedContrat],
  );
  const selectedMonthState = getPaymentMonthState(
    selectedContrat,
    paiements,
    formData.mois_display,
    editingPaiement?.id,
  );
  const commission = selectedContrat?.commission ?? selectedContrat?.pourcentage_agence ?? null;
  const montantSaisi = Number(formData.montant_total || 0);
  const loyerAttendu = Number(selectedContrat?.loyer_mensuel || 0);
  const paiementsPrecedents = selectedMonthState?.paidAmount ?? 0;
  const totalApresPaiement = paiementsPrecedents + montantSaisi;
  const reliquatPreview = selectedContrat ? Math.max(loyerAttendu - totalApresPaiement, 0) : 0;
  const tropPercuPreview = selectedContrat ? Math.max(totalApresPaiement - loyerAttendu, 0) : 0;
  const tauxCommission = Number(commission || 0);
  const commissionPreview = Math.round((montantSaisi * tauxCommission) / 100);
  const netBailleurPreview = Math.max(montantSaisi - commissionPreview, 0);
  const finalStatus = tropPercuPreview > 0 ? 'Avance' : reliquatPreview > 0 ? 'Partiel' : 'Soldé';
  const tauxCouverture = selectedContrat && loyerAttendu > 0
    ? Math.min(100, Math.round((totalApresPaiement / loyerAttendu) * 100))
    : 0;
  const locataireLabel = selectedContrat ? formatPersonName(selectedContrat.locataires, '') : '';
  const uniteLabel = selectedContrat?.unites?.nom ?? '';
  const immeubleLabel = selectedContrat?.unites?.immeubles?.nom ?? '';
  const bailleur = selectedContrat?.unites?.immeubles?.bailleurs;
  const bailleurLabel = bailleur ? formatPersonName(bailleur, '') : '';

  const stepOneValid = Boolean(
    selectedContrat
      && formData.mois_display
      && monthOptions.length > 0
      && !selectedMonthState?.isSold
      && !isCommissionMissing(commission),
  );
  const stepTwoValid = Boolean(
    Number.isFinite(montantSaisi)
      && montantSaisi > 0
      && formData.date_paiement
      && formData.payment_channel
      && tropPercuPreview <= 0,
  );
  const correctionReasonValid = !editingPaiement || formData.correction_reason.trim().length >= 5;
  const canSubmit = isOnline && !isSaving && stepOneValid && stepTwoValid && correctionReasonValid;

  const contractOptions: SmartComboboxOption[] = contrats.map((contrat) => ({
    value: contrat.id,
    label: `${formatPersonName(contrat.locataires)} - ${contrat.unites?.nom ?? 'Unité non renseignée'}`,
    subtitle: [
      contrat.unites?.immeubles?.nom,
      contrat.loyer_mensuel ? formatCurrency(contrat.loyer_mensuel) : null,
    ].filter(Boolean).join(' · '),
    keywords: `${formatPersonName(contrat.locataires)} ${contrat.unites?.nom ?? ''} ${contrat.unites?.immeubles?.nom ?? ''}`,
  }));

  const paymentMonthOptions: SmartComboboxOption[] = monthOptions.map((option) => ({
    value: option.value,
    label: option.label,
    subtitle: [
      option.isPartial ? `Reliquat ${formatCurrency(option.remainingAmount)}` : null,
      option.isFuture ? 'Paiement en avance' : null,
      option.isSold ? 'Mois soldé' : null,
    ].filter(Boolean).join(' · '),
    badge: option.isPartial ? 'Partiel' : option.isFuture ? 'Avance' : option.isSold ? 'Soldé' : undefined,
    disabled: option.isSold && option.value !== formData.mois_display,
  }));

  const paymentModeOptions: SmartComboboxOption[] = [
    { value: 'especes', label: 'Espèces' },
    { value: 'wave', label: 'Wave' },
    { value: 'orange_money', label: 'Orange Money' },
    { value: 'virement', label: 'Virement' },
    { value: 'cheque', label: 'Chèque' },
    { value: 'autre', label: 'Autre' },
    ...(formData.payment_channel === 'mobile_money'
      ? [{ value: 'mobile_money', label: 'Mobile Money (paiement existant)' }]
      : []),
  ];

  const handleContractChange = (contratId: string) => {
    const selected = contrats.find((contrat) => contrat.id === contratId);
    const options = buildPaymentMonthOptions(selected, paiements, {
      excludePaymentId: editingPaiement?.id,
      selectedMonth: formData.mois_display,
    });
    const preferredMonth = options.find((option) => !option.isSold) ?? options[0];
    setFormData((previous) => ({
      ...previous,
      contrat_id: contratId,
      mois_display: preferredMonth?.value ?? previous.mois_display,
      mois_concerne: preferredMonth ? `${preferredMonth.value}-01` : previous.mois_concerne,
      montant_total: selected
        ? String(preferredMonth?.remainingAmount && preferredMonth.remainingAmount > 0
          ? preferredMonth.remainingAmount
          : selected.loyer_mensuel)
        : '',
      statut: 'paye',
    }));
  };

  const handleMoisChange = (monthValue: string) => {
    const contrat = contrats.find((item) => item.id === formData.contrat_id);
    const monthState = getPaymentMonthState(contrat, paiements, monthValue, editingPaiement?.id);
    setFormData((previous) => ({
      ...previous,
      mois_display: monthValue,
      mois_concerne: `${monthValue}-01`,
      montant_total: contrat && monthState?.remainingAmount && monthState.remainingAmount > 0
        ? String(monthState.remainingAmount)
        : previous.montant_total,
    }));
  };

  return (
    <WizardShell
      open={isOpen}
      onClose={() => {
        if (!isSaving) onClose();
      }}
      size="standard"
      variant="workstation"
      tone="finance"
      eyebrow="ENCAISSEMENT & FINANCE"
      title={editingPaiement ? 'Corriger une erreur de paiement' : 'Nouveau paiement'}
      description={editingPaiement ? 'Comparez les valeurs et justifiez la correction.' : 'Enregistrez un encaissement en trois étapes contrôlées.'}
      steps={PAYMENT_STEPS}
      currentStep={currentStep - 1}
      contentDescription={editingPaiement ? 'Comparez les valeurs et justifiez la correction.' : 'Enregistrez un encaissement en trois étapes contrôlées.'}
      stepContext={<PaiementWizardStepContext step={currentStep} isEditing={!!editingPaiement} />}
      rail={
        <PaiementWizardRail
          steps={PAYMENT_STEPS}
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
            {editingPaiement ? 'Valider la correction' : 'Enregistrer le paiement'}
          </Button>
        )
      }
    >
      <form onSubmit={(event) => event.preventDefault()} className="space-y-3 pb-[max(0.25rem,env(safe-area-inset-bottom))]">

        {currentStep === 1 && (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[0.75rem] font-bold uppercase tracking-wider text-slate-700">
                Contrat actif <span className="text-red-600">*</span>
              </label>
              <SmartCombobox
                value={formData.contrat_id}
                options={contractOptions}
                onChange={handleContractChange}
                placeholder="Sélectionner un contrat"
                searchPlaceholder="Locataire, unité ou bien"
                emptyLabel="Aucun contrat actif disponible."
                emptyActionLabel="Aller aux locations"
                onEmptyAction={() => {
                  window.location.hash = '#/occupants-baux';
                  onClose();
                }}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[0.75rem] font-bold uppercase tracking-wider text-slate-700">
                Échéance <span className="text-red-600">*</span>
              </label>
              <SmartCombobox
                value={formData.mois_display}
                options={paymentMonthOptions}
                onChange={handleMoisChange}
                placeholder="Sélectionner une échéance"
                searchPlaceholder="Mois, reliquat ou avance"
                emptyLabel="Aucune échéance payable disponible."
              />
            </div>

            {selectedContrat && (
              <section className="grid gap-2.5 rounded-xl border border-emerald-950/10 bg-[#fffdf8] p-2.5 shadow-sm sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800">Identité de l’échéance</p>
                  <dl className="mt-1.5 space-y-1.5 text-[0.72rem]">
                    <SummaryLine label="Locataire" value={locataireLabel || 'Non renseigné'} />
                    <SummaryLine label="Bien / unité" value={[immeubleLabel, uniteLabel].filter(Boolean).join(' · ') || 'Non renseigné'} />
                    <SummaryLine label="Bailleur" value={bailleurLabel || 'Non renseigné'} />
                    <SummaryLine label="Période" value={formatPaymentPeriod(formData.mois_display)} />
                  </dl>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-2.5">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800">Situation financière</p>
                  <dl className="mt-1.5 space-y-1.5 text-[0.72rem]">
                    <SummaryLine label="Loyer attendu" value={formatCurrency(loyerAttendu)} />
                    <SummaryLine label="Déjà encaissé" value={formatCurrency(paiementsPrecedents)} />
                    <SummaryLine label="Reste à payer" value={formatCurrency(selectedMonthState?.remainingAmount ?? loyerAttendu)} />
                    <SummaryLine label="Statut actuel" value={selectedMonthState?.isPartial ? 'Partiel' : selectedMonthState?.isSold ? 'Soldé' : 'À encaisser'} />
                  </dl>
                </div>
              </section>
            )}

            {selectedContrat && isCommissionMissing(commission) && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs font-semibold leading-5 text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                La commission de ce contrat doit être configurée avant l’encaissement.
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[0.75rem] font-bold uppercase tracking-wider text-slate-700">
                Montant encaissé <span className="text-red-600">*</span>
              </label>
              <input aria-label="Champ de saisie"
                type="number"
                required
                min="1"
                step="1"
                inputMode="numeric"
                value={formData.montant_total}
                onChange={(event) => setFormData((previous) => ({ ...previous, montant_total: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-extrabold tabular-nums text-slate-950 shadow-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
              />
              {selectedContrat && (
                <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50 p-2.5">
                  <div className="flex items-center justify-between gap-3 text-xs font-black text-emerald-950">
                    <span>{tauxCouverture}% couvert</span>
                    <span>{reliquatPreview > 0 ? `Reliquat ${formatCurrency(reliquatPreview)}` : 'Échéance soldée'}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-emerald-700 transition-all duration-300" style={{ width: `${tauxCouverture}%` }} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[0.72rem] font-semibold text-emerald-900">
                    <span>Après paiement : <strong>{finalStatus}</strong></span>
                    {tropPercuPreview > 0 && <span>Avance détectée : <strong>{formatCurrency(tropPercuPreview)}</strong></span>}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[0.75rem] font-bold uppercase tracking-wider text-slate-700">Date du paiement <span className="text-red-600">*</span></label>
                <input aria-label="Champ de saisie"
                  type="date"
                  required
                  value={formData.date_paiement}
                  onChange={(event) => setFormData((previous) => ({ ...previous, date_paiement: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[0.75rem] font-bold uppercase tracking-wider text-slate-700">Mode de paiement <span className="text-red-600">*</span></label>
                <SmartCombobox
                  value={formData.payment_channel}
                  options={paymentModeOptions}
                  onChange={(value) => {
                    const channel = value as PaymentChannel;
                    setFormData((previous) => ({
                      ...previous,
                      payment_channel: channel,
                      mode_paiement: paymentChannelToMode(channel),
                    }));
                  }}
                  placeholder="Sélectionner le mode"
                  searchPlaceholder="Espèces, Wave, Orange Money…"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[0.75rem] font-bold uppercase tracking-wider text-slate-700">Référence de transaction</label>
              <input
                type="text"
                value={formData.reference}
                onChange={(event) => setFormData((previous) => ({ ...previous, reference: event.target.value }))}
                placeholder="Numéro Wave, chèque ou virement (facultatif)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-900/10"
              />
            </div>

            {tropPercuPreview > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 p-2.5 text-xs font-semibold leading-5 text-orange-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Le montant dépasse le reste à payer de {formatCurrency(tropPercuPreview)}. Ce workflow n’enregistre pas de surpaiement implicite.
              </div>
            )}

            {!isOnline && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs font-semibold leading-5 text-amber-900">
                <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                L’encaissement doit être confirmé en ligne. Rétablissez la connexion pour continuer.
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-3">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-2.5">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800">Identité</p>
                <dl className="mt-1.5 space-y-1.5 text-[0.72rem]">
                  <SummaryLine label="Locataire" value={locataireLabel || 'Non renseigné'} />
                  <SummaryLine label="Bien / unité" value={[immeubleLabel, uniteLabel].filter(Boolean).join(' · ') || 'Non renseigné'} />
                  <SummaryLine label="Bailleur" value={bailleurLabel || 'Non renseigné'} />
                  <SummaryLine label="Période" value={formatPaymentPeriod(formData.mois_display)} />
                </dl>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-2.5">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800">Paiement</p>
                <dl className="mt-1.5 space-y-1.5 text-[0.72rem]">
                  <SummaryLine label="Montant encaissé" value={formatCurrency(montantSaisi)} />
                  <SummaryLine label="Date" value={formData.date_paiement ? new Date(`${formData.date_paiement}T00:00:00`).toLocaleDateString('fr-FR') : 'Non renseignée'} />
                  <SummaryLine label="Mode" value={paymentModeOptions.find((option) => option.value === formData.payment_channel)?.label ?? 'Non renseigné'} />
                  <SummaryLine label="Référence" value={formData.reference.trim() || 'Non renseignée'} />
                </dl>
              </section>
            </div>

            {editingPaiement && (
              <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-900">Valeur actuelle → nouvelle valeur</p>
                <div className="mt-2 grid grid-cols-2 gap-2.5">
                  <div className="rounded-lg bg-white p-2.5 ring-1 ring-amber-200">
                    <p className="text-[9px] font-black uppercase text-slate-500">Avant</p>
                    <p className="mt-0.5 text-sm font-black text-slate-950"><MoneyText value={editingPaiement.montant_total} /></p>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 ring-1 ring-emerald-200">
                    <p className="text-[9px] font-black uppercase text-slate-500">Après</p>
                    <p className="mt-0.5 text-sm font-black text-emerald-800"><MoneyText value={montantSaisi} /></p>
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-xl border border-emerald-950/10 bg-white p-3 shadow-sm">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">Impact avant validation</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">Le serveur recalculera et confirmera les montants définitifs.</p>
                </div>
                <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { label: 'Loyer attendu', value: loyerAttendu, tone: 'slate' },
                  { label: 'Déjà encaissé', value: paiementsPrecedents, tone: 'slate' },
                  { label: 'Nouveau paiement', value: montantSaisi, tone: 'emerald' },
                  { label: 'Total après paiement', value: totalApresPaiement, tone: 'emerald' },
                  { label: 'Reliquat après paiement', value: reliquatPreview, tone: reliquatPreview > 0 ? 'orange' : 'emerald' },
                  { label: 'Avance', value: tropPercuPreview, tone: tropPercuPreview > 0 ? 'orange' : 'slate' },
                  { label: `Commission (${tauxCommission}%)`, value: commissionPreview, tone: 'slate' },
                  { label: 'Net bailleur', value: netBailleurPreview, tone: 'emerald' },
                ].map((item) => (
                  <div key={item.label} className={`rounded-lg border p-2 ${
                    item.tone === 'emerald'
                      ? 'border-emerald-200 bg-emerald-50'
                      : item.tone === 'orange'
                        ? 'border-orange-200 bg-orange-50'
                        : 'border-slate-200 bg-slate-50'
                  }`}>
                    <p className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-500">{item.label}</p>
                    <p className="mt-0.5 text-xs font-extrabold tabular-nums text-slate-950"><MoneyText value={item.value} /></p>
                  </div>
                ))}
              </div>

              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2.5 rounded-lg border border-emerald-100 bg-[#fffdf8] p-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-500">Statut prévu</p>
                    <p className="text-xs font-bold text-slate-950">{finalStatus}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg border border-emerald-100 bg-[#fffdf8] p-2.5">
                  <FileCheck2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-500">Document généré</p>
                    <p className="text-xs font-bold text-slate-950">Quittance ou reçu QR</p>
                  </div>
                </div>
              </div>
            </section>

            {editingPaiement && (
              <div>
                <label className="mb-1.5 block text-[0.75rem] font-bold uppercase tracking-wider text-slate-700">
                  Raison de la correction <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={formData.correction_reason}
                  onChange={(event) => setFormData((previous) => ({ ...previous, correction_reason: event.target.value }))}
                  rows={3}
                  maxLength={400}
                  placeholder="Décrivez l’erreur corrigée pour préserver une trace claire."
                />
              </div>
            )}

            <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-semibold leading-5 text-emerald-950">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Cette prévisualisation guide la validation. Les montants et le statut définitifs proviennent du traitement financier sécurisé.
              <TooltipHint label="Pourquoi une prévisualisation ?">
                Le formulaire n’écrit aucun calcul financier directement. La validation finale reste effectuée par le serveur.
              </TooltipHint>
            </div>
          </div>
        )}
      </form>
    </WizardShell>
  );
}

function PaiementWizardRail({ steps, currentStep }: { steps: WizardStep[]; currentStep: number }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2.5">
        <BrandMark size="sm" tone="dark" animated withTile={false} />
        <div>
          <p className="text-[0.5rem] font-bold uppercase tracking-[0.18em] text-emerald-200/80">Trésorerie & Loyers</p>
          <p className="mt-0.5 text-[0.6rem] font-semibold text-white/[0.56]">Encaissement guidé</p>
        </div>
      </div>

      <div className="mt-3">
        <p className="max-w-[11rem] text-[0.72rem] font-semibold leading-tight text-white/[0.86]">
          Sécurisez les encaissements.
        </p>
        <p className="mt-1 max-w-[11rem] text-[0.6rem] font-medium leading-snug text-emerald-50/[0.56]">
          Traçabilité bancaire, calcul du solde et génération automatique des quittances.
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
          Impacte directement le solde locataire, la comptabilité et le rapport bailleur.
        </p>
      </div>
    </div>
  );
}

function PaiementWizardStepContext({ step, isEditing }: { step: number; isEditing: boolean }) {
  const copy: Record<number, { title?: string; body: string }> = {
    1: {
      title: 'Sélection du bail et échéance',
      body: 'Identifiez le contrat de location et sélectionnez l’échéance pour charger le loyer attendu et le solde du locataire.',
    },
    2: {
      title: 'Saisie du règlement',
      body: 'Renseignez le montant reçu, le canal de règlement (mobile money, virement, chèque) et la référence de transaction.',
    },
    3: {
      title: isEditing ? 'Validation de la correction' : 'Contrôle et impact financier',
      body: 'Vérifiez la ventilation financière avant l’enregistrement définitif et la génération de la quittance conforme.',
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

