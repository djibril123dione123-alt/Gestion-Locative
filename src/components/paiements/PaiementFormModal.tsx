import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingPaiement ? 'Modifier le paiement' : 'Nouveau paiement'}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
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
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">Sélectionner un contrat</option>
            {contrats.map((contrat) => (
              <option key={contrat.id} value={contrat.id}>
                {contrat.locataires?.prenom} {contrat.locataires?.nom} — {contrat.unites?.nom}
              </option>
            ))}
          </select>
          {formData.contrat_id && isCommissionMissing(commission) && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
              <span>
                Ce contrat n'a pas de commission configurée. Veuillez la définir dans la fiche contrat
                avant d'enregistrer.
              </span>
            </div>
          )}
        </div>

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
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            {selectedContrat && (
              <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs font-medium text-emerald-900">
                {reliquatPreview > 0
                  ? `Paiement partiel accepté. Reliquat estimé : ${reliquatPreview.toLocaleString('fr-FR')} FCFA.`
                  : 'Paiement complet pour cette échéance.'}
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
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
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
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
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
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="especes">Espèces</option>
              <option value="cheque">Chèque</option>
              <option value="virement">Virement</option>
              <option value="mobile_money">Mobile Money</option>
            </select>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
              <div>
                <p className="font-semibold text-slate-900">Statut automatique</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Le serveur calcule le statut : partiel si un reliquat reste dû, payé si l'échéance est soldée.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Référence (facultatif)
            </label>
            <input
              type="text"
              value={formData.reference}
              onChange={(event) => setFormData((prev) => ({ ...prev, reference: event.target.value }))}
              placeholder="N° de chèque, transaction..."
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
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
