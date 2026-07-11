import { CreditCard, Hourglass, ReceiptText, TrendingUp } from 'lucide-react';
import { ADMIN_PLAN_DEFINITIONS, getAdminPlan } from '../../../lib/admin/adminPricingCatalog';
import { paymentExpectedAmount, paymentHasAmountAnomaly, summarizeSaasRevenue } from '../../../lib/admin/adminInsights';
import { formatAdminCurrency, formatAdminDate } from '../../../lib/admin/adminFormatters';
import { AdminEmptyState, AdminMetricCard, AdminPanel, AdminStatusBadge, ResponsiveTable } from '../../../components/console/AdminPrimitives';
import type { AdminConsoleData, SubscriptionPaymentProof } from '../../../services/admin/adminConsoleService';

export function BillingTab({ data, onOpenProof }: { data: AdminConsoleData; onOpenProof: (proof: SubscriptionPaymentProof) => void }) {
  const pendingProofs = data.proofs.filter((proof) => proof.status === 'pending');
  const approvedProofs = data.proofs.filter((proof) => proof.status === 'approved');
  const rejectedProofs = data.proofs.filter((proof) => proof.status === 'rejected');
  const anomalies = pendingProofs.filter(paymentHasAmountAnomaly);
  const revenue = summarizeSaasRevenue(data);
  const planCounts = ADMIN_PLAN_DEFINITIONS.map((plan) => ({
    plan,
    count: data.agencies.filter((agency) => getAdminPlan(agency.plan).id === plan.id).length,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard label="MRR estimé" value={formatAdminCurrency(revenue.mrr)} helper="Source opérationnelle" icon={TrendingUp} tone="orange" />
        <AdminMetricCard label="ARR estimé" value={formatAdminCurrency(revenue.arr)} helper="Projection annuelle" icon={TrendingUp} tone="blue" />
        <AdminMetricCard label="Abonnements actifs" value={data.subscriptions.filter((sub) => sub.status === 'active').length} icon={CreditCard} tone="emerald" />
        <AdminMetricCard label="Preuves en attente" value={pendingProofs.length} helper={formatAdminCurrency(revenue.pendingAmount)} icon={Hourglass} tone={pendingProofs.length ? 'amber' : 'emerald'} />
        <AdminMetricCard label="Anomalies" value={anomalies.length} helper="Montant / preuve" icon={ReceiptText} tone={anomalies.length ? 'red' : 'slate'} />
      </div>

      <AdminPanel title="Paiements manuels à valider" subtitle="Validation avec audit strict, contrôle montant attendu et activation du plan après confirmation.">
        <ResponsiveTable
          rows={pendingProofs}
          getKey={(proof) => proof.id}
          empty={<AdminEmptyState title="Aucun paiement manuel en attente" text="Les preuves transmises par les agences apparaîtront ici pour validation." />}
          columns={[
            { key: 'org', label: 'Organisation', render: (proof) => <span className="font-black text-slate-950">{proof.agencies?.name ?? proof.agency_id}</span> },
            { key: 'plan', label: 'Plan', render: (proof) => <AdminStatusBadge tone="orange">{getAdminPlan(proof.plan_key).name}</AdminStatusBadge> },
            { key: 'amount', label: 'Déclaré', align: 'right', render: (proof) => <span className="font-black">{formatAdminCurrency(proof.amount)}</span> },
            { key: 'expected', label: 'Attendu', align: 'right', render: (proof) => <span className={paymentHasAmountAnomaly(proof) ? 'font-black text-red-700' : 'font-bold text-slate-700'}>{formatAdminCurrency(paymentExpectedAmount(proof))}</span> },
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
              {paymentHasAmountAnomaly(proof) && <p className="mt-2 rounded-xl bg-red-50 px-2 py-1 text-xs font-black text-red-700">Montant attendu : {formatAdminCurrency(paymentExpectedAmount(proof))}</p>}
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

        <AdminPanel title="Abonnements récents" subtitle="Plans, échéances, essais et renouvellements à surveiller.">
          <div className="space-y-2">
            {data.subscriptions.slice(0, 10).map((subscription) => (
              <div key={subscription.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{subscription.agency_name ?? subscription.agency_id}</p>
                  <p className="text-xs font-semibold text-slate-500">{getAdminPlan(subscription.plan_id).name} · échéance {formatAdminDate(subscription.current_period_end)}</p>
                </div>
                <AdminStatusBadge status={subscription.status} />
              </div>
            ))}
            {data.subscriptions.length === 0 && <AdminEmptyState title="Aucun abonnement chargé" text="Les abonnements apparaîtront ici dès que la source est disponible." />}
          </div>
        </AdminPanel>
      </div>

      <AdminPanel title="Historique preuves" subtitle="Vue compacte des paiements validés et rejetés, sans mélanger avec la finance locative.">
        <div className="grid gap-2 lg:grid-cols-2">
          {[...approvedProofs, ...rejectedProofs].slice(0, 12).map((proof) => (
            <button key={proof.id} type="button" onClick={() => onOpenProof(proof)} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950">{proof.agencies?.name ?? proof.agency_id}</p>
                <p className="text-xs font-semibold text-slate-500">{proof.method} · {formatAdminDate(proof.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-slate-900">{formatAdminCurrency(proof.amount)}</p>
                <AdminStatusBadge status={proof.status} />
              </div>
            </button>
          ))}
          {approvedProofs.length + rejectedProofs.length === 0 && <AdminEmptyState title="Aucun historique de preuve" text="Les preuves validées ou rejetées seront conservées ici." />}
        </div>
      </AdminPanel>
    </div>
  );
}
