import { ExternalLink, X } from 'lucide-react';
import { getAdminPlan } from '../../lib/admin/adminPricingCatalog';
import { formatAdminCurrency, formatAdminDate, textValue } from '../../lib/admin/adminFormatters';
import { AdminButton, AdminPanel, AdminStatusBadge } from './AdminPrimitives';
import type { SubscriptionPaymentProof } from '../../services/admin/adminConsoleService';

export function PaymentValidationDrawer({
  proof,
  onClose,
  onApprove,
  onReject,
}: {
  proof: SubscriptionPaymentProof | null;
  onClose: () => void;
  onApprove: (proof: SubscriptionPaymentProof) => void;
  onReject: (proof: SubscriptionPaymentProof) => void;
}) {
  if (!proof) return null;
  const plan = getAdminPlan(proof.plan_key);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Fermer la preuve" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-[#f7f3ea] p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <AdminStatusBadge status={proof.status} />
            <h2 className="mt-3 text-xl font-black text-slate-950">Preuve de paiement</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">{proof.agencies?.name ?? 'Organisation'} · {formatAdminDate(proof.created_at)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid gap-4">
          <AdminPanel title="Résumé validation" subtitle="La validation active le plan si la preuve est confirmée.">
            <div className="grid gap-2 text-sm">
              {[
                ['Plan', plan.name],
                ['Montant déclaré', formatAdminCurrency(proof.amount)],
                ['Montant attendu', formatAdminCurrency(plan.price_xof)],
                ['Méthode', textValue(proof.method)],
                ['Référence', textValue(proof.reference)],
                ['Date paiement', formatAdminDate(proof.payment_date)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
                  <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">{label}</span>
                  <span className="text-right font-bold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </AdminPanel>
          <AdminPanel title="Preuve fournie" subtitle="Ouvrir la pièce ou le lien avant validation.">
            {proof.proof_file_url ? (
              <a href={proof.proof_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-900">
                <ExternalLink className="h-3.5 w-3.5" />
                Ouvrir la preuve
              </a>
            ) : (
              <p className="text-xs font-semibold text-slate-500">Aucun fichier transmis. Vérifier la référence et le commentaire avant validation.</p>
            )}
            {proof.comment && <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700">{proof.comment}</p>}
          </AdminPanel>
          {proof.status === 'pending' && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AdminButton variant="danger" onClick={() => onReject(proof)}>Rejeter</AdminButton>
              <AdminButton variant="primary" onClick={() => onApprove(proof)}>Valider et activer</AdminButton>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
