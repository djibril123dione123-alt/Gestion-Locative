import { CreditCard, Hourglass, ReceiptText, TrendingUp } from 'lucide-react';
import { ADMIN_PLAN_DEFINITIONS, getAdminPlan } from '../../../lib/admin/adminPricingCatalog';
import { formatAdminCurrency, formatAdminDate } from '../../../lib/admin/adminFormatters';
import { AdminEmptyState, AdminMetricCard, AdminPanel, AdminStatusBadge, ResponsiveTable } from '../../../components/console/AdminPrimitives';
import type { AdminConsoleData, SubscriptionPaymentProof } from '../../../services/admin/adminConsoleService';

export function BillingTab({ data, onOpenProof }: { data: AdminConsoleData; onOpenProof: (proof: SubscriptionPaymentProof) => void }) {
  const pendingProofs = data.proofs.filter((proof) => proof.status === 'pending');
  const approvedProofs = data.proofs.filter((proof) => proof.status === 'approved');
  const rejectedProofs = data.proofs.filter((proof) => proof.status === 'rejected');
  const planCounts = ADMIN_PLAN_DEFINITIONS.map((plan) => ({
    plan,
    count: data.agencies.filter((agency) => getAdminPlan(agency.plan).id === plan.id).length,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="MRR estimé" value={formatAdminCurrency(data.platform.estimatedMrr)} helper="Source opérationnelle" icon={TrendingUp} tone="orange" />
        <AdminMetricCard label="Abonnements actifs" value={data.subscriptions.filter((sub) => sub.status === 'active').length} icon={CreditCard} tone="emerald" />
        <AdminMetricCard label="Preuves en attente" value={pendingProofs.length} icon={Hourglass} tone={pendingProofs.length ? 'amber' : 'emerald'} />
        <AdminMetricCard label="Preuves validées" value={approvedProofs.length} helper={`${rejectedProofs.length} rejetée(s)`} icon={ReceiptText} />
      </div>

      <AdminPanel title="Paiements manuels à valider" subtitle="Validation avec audit strict et activation du plan après confirmation.">
        <ResponsiveTable
          rows={pendingProofs}
          getKey={(proof) => proof.id}
          empty={<AdminEmptyState title="Aucun paiement manuel en attente" text="Les preuves transmises par les agences apparaîtront ici pour validation." />}
          columns={[
            { key: 'org', label: 'Organisation', render: (proof) => <span className="font-black text-slate-950">{proof.agencies?.name ?? proof.agency_id}</span> },
            { key: 'plan', label: 'Plan', render: (proof) => <AdminStatusBadge tone="orange">{getAdminPlan(proof.plan_key).name}</AdminStatusBadge> },
            { key: 'amount', label: 'Montant', align: 'right', render: (proof) => <span className="font-black">{formatAdminCurrency(proof.amount)}</span> },
            { key: 'method', label: 'Moyen', render: (proof) => proof.method },
            { key: 'ref', label: 'Référence', render: (proof) => proof.reference ?? 'Non renseignée' },
            { key: 'date', label: 'Soumis', render: (proof) => formatAdminDate(proof.created_at) },
            { key: 'action', label: 'Action', align: 'right', render: (proof) => <button type="button" onClick={() => onOpenProof(proof)} className="rounded-xl border border-emerald-900 bg-emerald-950 px-3 py-2 text-xs font-black text-white">Examiner</button> },
          ]}
          renderCard={(proof) => (
            <button type="button" onClick={() => onOpenProof(proof)} className="rounded-2xl border border-slate-200 bg-white p-3 text-left">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{proof.agencies?.name ?? proof.agency_id}</p>
                  <p className="text-xs font-semibold text-slate-500">{proof.method} · {proof.reference ?? 'Référence non renseignée'}</p>
                </div>
                <span className="font-black text-emerald-800">{formatAdminCurrency(proof.amount)}</span>
              </div>
            </button>
          )}
        />
      </AdminPanel>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <AdminPanel title="Répartition par plan" subtitle="Catalogue unique Starter, Pro, Business, Enterprise.">
          <div className="grid gap-2">
            {planCounts.map(({ plan, count }) => (
              <div key={plan.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div>
                  <p className="text-sm font-black text-slate-900">{plan.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{plan.priceLabel} · {plan.audience}</p>
                </div>
                <AdminStatusBadge tone="slate">{count}</AdminStatusBadge>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="Abonnements récents" subtitle="Vue compacte des plans et échéances.">
          <div className="space-y-2">
            {data.subscriptions.slice(0, 8).map((subscription) => (
              <div key={subscription.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{subscription.agency_name ?? subscription.agency_id}</p>
                  <p className="text-xs font-semibold text-slate-500">{getAdminPlan(subscription.plan_id).name} · échéance {formatAdminDate(subscription.current_period_end)}</p>
                </div>
                <AdminStatusBadge status={subscription.status} />
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
