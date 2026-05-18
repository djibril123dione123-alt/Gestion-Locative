import React from 'react';
import { AlertTriangle, Building2, CreditCard, Home, Info, UserRound, Wallet, WifiOff } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { isCommissionMissing } from '../../services/domain/commissionService';
import type { ContratRow, PaiementFormData, PaiementRow } from './paiementTypes';

interface PaiementFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingPaiement: PaiementRow | null;
  formData: PaiementFormData;
  setFormData: React.Dispatch<React.SetStateAction<PaiementFormData>>;
  contrats: ContratRow[];
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  isOnline: boolean;
}

export function PaiementFormModal({
  isOpen,
  onClose,
  editingPaiement,
  formData,
  setFormData,
  contrats,
  isSaving,
  onSubmit,
  isOnline,
}: PaiementFormModalProps) {
  const handleMoisChange = (monthValue: string) => {
    setFormData((prev) => ({
      ...prev,
      mois_display: monthValue,
      mois_concerne: `${monthValue}-01`,
    }));
  };

  const selectedContrat = contrats.find((contrat) => contrat.id === formData.contrat_id);
  const commission = selectedContrat?.commission ?? selectedContrat?.pourcentage_agence ?? null;
  const montantSaisi = Number(formData.montant_total || 0);
  const loyerAttendu = Number(selectedContrat?.loyer_mensuel || 0);
  const reliquatPreview = selectedContrat ? Math.max(loyerAttendu - montantSaisi, 0) : 0;
  const tropPercuPreview = selectedContrat ? Math.max(montantSaisi - loyerAttendu, 0) : 0;
  const tauxCouverture =
    selectedContrat && loyerAttendu > 0
      ? Math.min(100, Math.round((montantSaisi / loyerAttendu) * 100))
      : 0;
  const locataireLabel = selectedContrat
    ? `${selectedContrat.locataires?.prenom ?? ''} ${selectedContrat.locataires?.nom ?? ''}`.trim()
    : '';
  const uniteLabel = selectedContrat?.unites?.nom ?? '';
  const immeubleLabel = selectedContrat?.unites?.immeubles?.nom ?? '';
  const bailleur = selectedContrat?.unites?.immeubles?.bailleurs;
  const bailleurLabel = bailleur ? `${bailleur.prenom ?? ''} ${bailleur.nom ?? ''}`.trim() : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingPaiement ? 'Modifier le paiement' : 'Nouveau paiement'}
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-5 text-white shadow-xl shadow-emerald-950/20">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10 text-orange-200 ring-1 ring-white/15">
              <Wallet className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">
                Encaissement sécurisé
              </p>
              <h3 className="mt-1 text-xl font-black">
                {editingPaiement ? 'Modifier le paiement' : 'Payer ce loyer'}
              </h3>
              <p className="mt-1 text-sm leading-6 text-emerald-50/75">
                Paiement partiel, exact ou régularisation. Le serveur calcule le reliquat et le statut comptable.
              </p>
            </div>
          </div>

          {selectedContrat && (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-white/9 p-3 ring-1 ring-white/10">
                <UserRound className="mb-2 h-4 w-4 text-orange-200" />
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100/70">
                  Locataire
                </p>
                <p className="mt-1 truncate text-sm font-black">{locataireLabel || 'Non renseigné'}</p>
              </div>
              <div className="rounded-2xl bg-white/9 p-3 ring-1 ring-white/10">
                <Home className="mb-2 h-4 w-4 text-orange-200" />
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100/70">
                  Unité
                </p>
                <p className="mt-1 truncate text-sm font-black">{uniteLabel || 'Non renseignée'}</p>
              </div>
              <div className="rounded-2xl bg-white/9 p-3 ring-1 ring-white/10">
                <Building2 className="mb-2 h-4 w-4 text-orange-200" />
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100/70">
                  Immeuble
                </p>
                <p className="mt-1 truncate text-sm font-black">{immeubleLabel || bailleurLabel || 'Non renseigné'}</p>
              </div>
              <div className="rounded-2xl bg-white/9 p-3 ring-1 ring-white/10">
                <CreditCard className="mb-2 h-4 w-4 text-orange-200" />
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100/70">
                  Loyer attendu
                </p>
                <p className="mt-1 text-sm font-black tabular-nums">
                  {loyerAttendu.toLocaleString('fr-FR')} FCFA
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Contrat <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.contrat_id}
            onChange={(event) => {
              const selected = contrats.find((contrat) => contrat.id === event.target.value);
              setFormData((prev) => ({
                ...prev,
                contrat_id: event.target.value,
                montant_total: selected?.loyer_mensuel?.toString() || '',
                statut: 'paye',
              }));
            }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 transition focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
          >
            <option value="">Sélectionner un contrat</option>
            {contrats.map((contrat) => (
              <option key={contrat.id} value={contrat.id}>
                {contrat.locataires?.prenom} {contrat.locataires?.nom} - {contrat.unites?.nom}
              </option>
            ))}
          </select>
          {formData.contrat_id && isCommissionMissing(commission) && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <span>
                Ce contrat n'a pas de commission configurée. Veuillez la définir dans la fiche contrat avant d'enregistrer.
              </span>
            </div>
          )}
        </div>

        {selectedContrat && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Résumé financier</p>
                <p className="mt-1 text-sm text-slate-600">Contrôle métier avant validation serveur.</p>
              </div>
              <CreditCard className="h-5 w-5 text-orange-500" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Période</p>
                <p className="mt-1 text-sm font-black text-slate-950">{formData.mois_display || '-'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Montant dû</p>
                <p className="mt-1 text-sm font-black tabular-nums text-slate-950">{loyerAttendu.toLocaleString('fr-FR')} FCFA</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">Reliquat</p>
                <p className="mt-1 text-sm font-black tabular-nums text-emerald-950">{reliquatPreview.toLocaleString('fr-FR')} FCFA</p>
              </div>
              <div className="rounded-xl bg-orange-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-orange-700">Avance</p>
                <p className="mt-1 text-sm font-black tabular-nums text-orange-950">{tropPercuPreview.toLocaleString('fr-FR')} FCFA</p>
              </div>
            </div>
            {tropPercuPreview > 0 && (
              <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs leading-5 text-orange-800">
                Le montant dépasse l'échéance sélectionnée. La validation serveur doit traiter ce surplus comme avance ou régularisation selon la règle financière active.
              </div>
            )}
            {!isOnline && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                <WifiOff className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>Mode hors ligne : l'encaissement sera placé en file d'attente et synchronisé automatiquement au retour de connexion.</span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Montant encaissé <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min="0"
              step="any"
              value={formData.montant_total}
              onChange={(event) => setFormData((prev) => ({ ...prev, montant_total: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-black tabular-nums text-slate-950 shadow-sm transition focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
            {selectedContrat && (
              <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3">
                <div className="flex items-center justify-between gap-3 text-xs font-black text-emerald-900">
                  <span>{tauxCouverture}% couvert</span>
                  <span>
                    {reliquatPreview > 0
                      ? `Reliquat : ${reliquatPreview.toLocaleString('fr-FR')} FCFA`
                      : 'Échéance soldée'}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-700 to-orange-400 transition-all duration-500"
                    style={{ width: `${tauxCouverture}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Mois concerné <span className="text-red-500">*</span>
            </label>
            <input
              type="month"
              required
              value={formData.mois_display}
              onChange={(event) => handleMoisChange(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-900 shadow-sm transition focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Date paiement <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.date_paiement}
              onChange={(event) => setFormData((prev) => ({ ...prev, date_paiement: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-900 shadow-sm transition focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Mode <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.mode_paiement}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  mode_paiement: event.target.value as PaiementFormData['mode_paiement'],
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-900 shadow-sm transition focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value="especes">Espèces</option>
              <option value="cheque">Chèque</option>
              <option value="virement">Virement</option>
              <option value="mobile_money">Mobile Money</option>
            </select>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white px-4 py-3 text-sm text-slate-700">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-700" />
              <div>
                <p className="font-semibold text-slate-900">Statut automatique</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Le serveur calcule le statut : partiel si un reliquat reste dû, payé si l'échéance est soldée.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Référence (facultatif)</label>
            <input
              type="text"
              value={formData.reference}
              onChange={(event) => setFormData((prev) => ({ ...prev, reference: event.target.value }))}
              placeholder="Numéro chèque, transaction..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-900 shadow-sm transition focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>
        </div>

        <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-200 pt-4 sm:flex-row">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Annuler
          </Button>
          <Button type="submit" loading={isSaving}>
            {editingPaiement ? 'Enregistrer les modifications' : 'Créer le paiement'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
