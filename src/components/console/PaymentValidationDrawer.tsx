import { ExternalLink } from 'lucide-react';
import { PremiumDrawerShell } from '../ui/PremiumDrawerShell';
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
    <PremiumDrawerShell
      open={!!proof}
      onClose={onClose}
      size="compact"
      density="compact"
      desktopMode="floating"
      desktopAt="lg"
      className="h-full lg:!w-full"
      eyebrow={<AdminStatusBadge status={proof.status} />}
      title="Preuve de paiement"
      description={`${proof.agencies?.name ?? 'Organisation'} - ${formatAdminDate(proof.created_at)}`}
    >
      <div className="grid gap-3">
        <AdminPanel title="Résumé validation" subtitle="La validation active le plan si la preuve est confirmée.">
          <div className="grid gap-1.5 text-[0.72rem]">
            {[
              ['Plan', plan.name],
              ['Montant déclaré', formatAdminCurrency(proof.amount)],
              ['Montant attendu', formatAdminCurrency(plan.price_xof)],
              ['Méthode', textValue(proof.method)],
              ['Référence', textValue(proof.reference)],
              ['Date paiement', formatAdminDate(proof.payment_date)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0">
                <span className="text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span>
                <span className="text-right font-semibold text-slate-900">{value}</span>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="Preuve fournie" subtitle="Ouvrir la pièce ou le lien avant validation.">
          {proof.proof_file_url ? (
            <a href={proof.proof_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-[0.65rem] border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[0.68rem] font-semibold text-emerald-900">
              <ExternalLink className="h-3.5 w-3.5" />
              Ouvrir la preuve
            </a>
          ) : (
            <p className="text-xs font-semibold text-slate-500">Aucun fichier transmis. Vérifier la référence et le commentaire avant validation.</p>
          )}
          {proof.comment && <p className="mt-2.5 rounded-[0.75rem] border border-slate-200 bg-slate-50 p-2.5 text-[0.72rem] font-medium leading-4 text-slate-700">{proof.comment}</p>}
        </AdminPanel>

        {proof.status === 'pending' && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AdminButton variant="danger" onClick={() => onReject(proof)}>Rejeter</AdminButton>
            <AdminButton variant="primary" onClick={() => onApprove(proof)}>Valider et activer</AdminButton>
          </div>
        )}
      </div>
    </PremiumDrawerShell>
  );
}
