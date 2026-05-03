import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { isCommissionMissing } from '../../services/domain/commissionService';
import type { PaiementFormData, ContratRow, PaiementRow } from './paiementTypes';

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
      mois_concerne: monthValue + '-01',
    }));
  };

  const selectedContrat = contrats.find((c) => c.id === formData.contrat_id);
  const commission = selectedContrat?.commission ?? selectedContrat?.pourcentage_agence ?? null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingPaiement ? 'Modifier le paiement' : 'Nouveau paiement'}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Contrat <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.contrat_id}
            onChange={(e) => {
              const sel = contrats.find((c) => c.id === e.target.value);
              setFormData((prev) => ({
                ...prev,
                contrat_id: e.target.value,
                montant_total: sel?.loyer_mensuel?.toString() || '',
              }));
            }}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
          >
            <option value="">Sélectionner un contrat</option>
            {contrats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.locataires?.prenom} {c.locataires?.nom} — {c.unites?.nom}
              </option>
            ))}
          </select>
          {formData.contrat_id && isCommissionMissing(commission) && (
            <div className="flex items-start gap-2 mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
              <span>
                Ce contrat n'a pas de commission configurée. Veuillez la définir dans la
                fiche contrat avant d'enregistrer.
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Montant <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min="0"
              step="any"
              value={formData.montant_total}
              onChange={(e) => setFormData((prev) => ({ ...prev, montant_total: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Mois concerné <span className="text-red-500">*</span>
            </label>
            <input
              type="month"
              required
              value={formData.mois_display}
              onChange={(e) => handleMoisChange(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date paiement <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.date_paiement}
              onChange={(e) => setFormData((prev) => ({ ...prev, date_paiement: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Mode <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.mode_paiement}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, mode_paiement: e.target.value as PaiementFormData['mode_paiement'] }))
              }
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
            >
              <option value="especes">Espèces</option>
              <option value="cheque">Chèque</option>
              <option value="virement">Virement</option>
              <option value="mobile_money">Mobile Money</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Statut</label>
            <select
              value={formData.statut}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, statut: e.target.value as PaiementFormData['statut'] }))
              }
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
            >
              <option value="paye">Payé</option>
              <option value="partiel">Partiel</option>
              <option value="en_attente">En attente</option>
              <option value="impaye">Impayé</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Référence (facultatif)
            </label>
            <input
              type="text"
              value={formData.reference}
              onChange={(e) => setFormData((prev) => ({ ...prev, reference: e.target.value }))}
              placeholder="N° de chèque, transaction…"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-slate-200">
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
