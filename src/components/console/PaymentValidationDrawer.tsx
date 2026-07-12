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
      className="h-full"
      eyebrow={<AdminStatusBadge status={proof.status} />}
      title="Preuve de paiement"
      description={`${proof.agencies?.name ?? 'Organisation'} - ${formatAdminDate(proof.created_at)}`}
    >
      <div className="grid gap-3">
        <AdminPanel title="Resume validation" subtitle="La validation active le plan si la preuve est confirmee.">
          <div className="grid gap-2 text-sm">
            {[
              ['Plan', plan.name],
              ['Montant declare', formatAdminCurrency(proof.amount)],
              ['Montant attendu', formatAdminCurrency(plan.price_xof)],
              ['Methode', textValue(proof.method)],
              ['Reference', textValue(proof.reference)],
              ['Date paiement', formatAdminDate(proof.payment_date)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
                <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">{label}</span>
                <span className="text-right font-bold text-slate-900">{value}</span>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="Preuve fournie" subtitle="Ouvrir la piece ou le lien avant validation.">
          {proof.proof_file_url ? (
            <a href={proof.proof_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-900">
              <ExternalLink className="h-3.5 w-3.5" />
              Ouvrir la preuve
            </a>
          ) : (
            <p className="text-xs font-semibold text-slate-500">Aucun fichier transmis. Verifier la reference et le commentaire avant validation.</p>
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
    </PremiumDrawerShell>
  );
}
