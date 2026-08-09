import { useState } from 'react';
import { CreditCard, Hourglass, ReceiptText, TrendingUp } from 'lucide-react';
import { ADMIN_PLAN_DEFINITIONS, getAdminPlan } from '../../../lib/admin/adminPricingCatalog';
import { paymentExpectedAmount, paymentHasAmountAnomaly, summarizeSaasRevenue } from '../../../lib/admin/adminInsights';
import { formatAdminCurrency, formatAdminDate } from '../../../lib/admin/adminFormatters';
import {
  AdminEmptyState,
  AdminKpiGrid,
  AdminMetricCard,
  AdminPanel,
  AdminSectionTabs,
  AdminStatusBadge,
  ResponsiveTable,
} from '../../../components/console/AdminPrimitives';
import type { AdminConsoleData, SubscriptionPaymentProof } from '../../../services/admin/adminConsoleService';

type BillingView = 'proofs' | 'subscriptions' | 'history';

export function BillingTab({
  data,
  onOpenProof,
  onOpenAgencyById,
  selectedProofId,
}: {
  data: AdminConsoleData;
  onOpenProof: (proof: SubscriptionPaymentProof) => void;
  onOpenAgencyById: (agencyId: string | null | undefined) => void;
  selectedProofId?: string | null;
}) {
  const [view, setView] = useState<BillingView>('proofs');
  const [planFilter, setPlanFilter] = useState('all');
  const pendingProofs = data.proofs.filter((proof) => proof.status === 'pending');
  const approvedProofs = data.proofs.filter((proof) => proof.status === 'approved');
  const rejectedProofs = data.proofs.filter((proof) => proof.status === 'rejected');
  const historyProofs = [...approvedProofs, ...rejectedProofs]
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
  const anomalies = pendingProofs.filter(paymentHasAmountAnomaly);
  const revenue = summarizeSaasRevenue(data);
  const activeSubscriptions = data.subscriptions.filter((subscription) => subscription.status === 'active');
  const planCounts = ADMIN_PLAN_DEFINITIONS.map((plan) => ({
    plan,
    count: data.agencies.filter((agency) => getAdminPlan(agency.plan).id === plan.id).length,
  }));
  const visibleSubscriptions = planFilter === 'all'
    ? data.subscriptions
    : data.subscriptions.filter((subscription) => getAdminPlan(subscription.plan_id).id === planFilter);

  return (
    <div className="space-y-3">
      <AdminKpiGrid maxItems={5}>
        <AdminMetricCard label="MRR" value={formatAdminCurrency(revenue.mrr)} helper="Revenu mensuel estimé" icon={TrendingUp} tone="orange" onClick={() => { setPlanFilter('all'); setView('subscriptions'); }} />
        <AdminMetricCard label="ARR" value={formatAdminCurrency(revenue.arr)} helper="Projection annuelle" icon={TrendingUp} tone="blue" onClick={() => { setPlanFilter('all'); setView('subscriptions'); }} />
        <AdminMetricCard label="Actifs" value={activeSubscriptions.length} helper="Abonnements actifs" icon={CreditCard} tone="emerald" onClick={() => { setPlanFilter('all'); setView('subscriptions'); }} />
        <AdminMetricCard label="Preuves" value={pendingProofs.length} helper={`${formatAdminCurrency(revenue.pendingAmount)} à valider`} icon={Hourglass} tone={pendingProofs.length ? 'amber' : 'emerald'} onClick={() => setView('proofs')} />
        <AdminMetricCard label="Anomalies" value={anomalies.length} helper="Écart de montant" icon={ReceiptText} tone={anomalies.length ? 'red' : 'slate'} onClick={() => setView('proofs')} />
      </AdminKpiGrid>

      <AdminSectionTabs
        value={view}
        onChange={(value) => setView(value as BillingView)}
        ariaLabel="Vues de facturation"
        items={[
          { value: 'proofs', label: 'Preuves à valider', count: pendingProofs.length },
          { value: 'subscriptions', label: 'Abonnements', count: data.subscriptions.length },
          { value: 'history', label: 'Historique', count: historyProofs.length },
        ]}
      />

      {view === 'proofs' && (
        <AdminPanel
          title="Paiements manuels à valider"
          subtitle="Contrôlez le montant, la référence et la preuve avant activation."
          bodyClassName="p-2 sm:p-2"
        >
          <ResponsiveTable<SubscriptionPaymentProof>
            rows={pendingProofs}
            getKey={(proof) => proof.id}
            selectedKey={selectedProofId}
            onRowClick={onOpenProof}
            rowAriaLabel={(proof) => `Examiner la preuve ${proof.reference ?? proof.id}`}
            empty={<AdminEmptyState title="Aucune preuve en attente" text="Toutes les preuves manuelles ont été traitées." />}
            columns={[
              {
                key: 'org',
                label: 'Organisation',
                className: selectedProofId ? 'w-[48%]' : undefined,
                render: (proof) => (
                  <span className="block min-w-0">
                    <span className="block truncate text-[0.76rem] font-semibold text-slate-950">{proof.agencies?.name ?? proof.agency_id}</span>
                    <span className="block truncate text-[0.68rem] font-semibold text-slate-500">
                      {proof.reference ?? 'Référence non renseignée'}
                      {selectedProofId ? ` · ${getAdminPlan(proof.plan_key).name} · ${proof.method}` : ''}
                    </span>
                  </span>
                ),
              },
              { key: 'plan', label: 'Plan', hideWhenDetail: true, render: (proof) => <AdminStatusBadge tone="orange">{getAdminPlan(proof.plan_key).name}</AdminStatusBadge> },
              { key: 'amount', label: 'Déclaré', align: 'right', render: (proof) => <span className="font-semibold">{formatAdminCurrency(proof.amount)}</span> },
              { key: 'expected', label: 'Attendu', align: 'right', render: (proof) => <span className={paymentHasAmountAnomaly(proof) ? 'font-black text-red-700' : 'font-bold text-slate-700'}>{formatAdminCurrency(paymentExpectedAmount(proof))}</span> },
              { key: 'method', label: 'Moyen', hideWhenDetail: true, render: (proof) => proof.method },
              { key: 'ref', label: 'Référence', hideWhenDetail: true, render: (proof) => proof.reference ?? 'Non renseignée' },
              { key: 'date', label: 'Soumis', hideWhenDetail: true, render: (proof) => formatAdminDate(proof.created_at) },
            ]}
            renderCard={(proof) => (
              <button type="button" onClick={() => onOpenProof(proof)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[0.78rem] font-semibold text-slate-950">{proof.agencies?.name ?? proof.agency_id}</p>
                    <p className="truncate text-xs font-semibold text-slate-500">{proof.method} · {proof.reference ?? 'Référence non renseignée'}</p>
                  </div>
                  <span className="whitespace-nowrap font-semibold text-emerald-800">{formatAdminCurrency(proof.amount)}</span>
                </div>
                {paymentHasAmountAnomaly(proof) && <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">Attendu : {formatAdminCurrency(paymentExpectedAmount(proof))}</p>}
              </button>
            )}
          />
        </AdminPanel>
      )}

      {view === 'subscriptions' && (
        <div className="grid items-start gap-3 xl:grid-cols-[0.78fr_1.22fr]">
          <AdminPanel title="Répartition par plan" subtitle="Portefeuille SaaS actuel.">
            <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
              {planCounts.map(({ plan, count }) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setPlanFilter((current) => current === plan.id ? 'all' : plan.id)}
                  aria-pressed={planFilter === plan.id}
                  className={`flex min-h-12 w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                    planFilter === plan.id
                      ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/35'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-[0.78rem] font-semibold text-slate-900">{plan.name}</p>
                    <p className="truncate text-[0.68rem] font-semibold text-slate-500">{plan.priceLabel} · {plan.audience}</p>
                  </div>
                  <AdminStatusBadge tone={count ? 'emerald' : 'slate'}>{count}</AdminStatusBadge>
                </button>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel
            title="Abonnements"
            subtitle={planFilter === 'all'
              ? 'Plans, échéances, essais et renouvellements.'
              : `${getAdminPlan(planFilter).name} · ${visibleSubscriptions.length} abonnement(s)`}
          >
            <div className="grid gap-1.5">
              {visibleSubscriptions.slice(0, 24).map((subscription) => (
                <button
                  key={subscription.id}
                  type="button"
                  onClick={() => onOpenAgencyById(subscription.agency_id)}
                  className="grid min-h-12 w-full gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-emerald-200 hover:bg-emerald-50/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-3"
                  aria-label={`Ouvrir l'organisation ${subscription.agency_name ?? subscription.agency_id}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[0.78rem] font-semibold text-slate-950">{subscription.agency_name ?? subscription.agency_id}</p>
                    <p className="text-[0.68rem] font-semibold text-slate-500">{getAdminPlan(subscription.plan_id).name}</p>
                  </div>
                  <span className="text-xs font-bold text-slate-500">Échéance {formatAdminDate(subscription.current_period_end)}</span>
                  <AdminStatusBadge status={subscription.status} />
                </button>
              ))}
              {visibleSubscriptions.length === 0 && (
                <AdminEmptyState
                  title="Aucun abonnement"
                  text={planFilter === 'all'
                    ? 'Aucun abonnement n’est enregistré pour le moment.'
                    : `Aucune organisation n’utilise le plan ${getAdminPlan(planFilter).name}.`}
                />
              )}
            </div>
          </AdminPanel>
        </div>
      )}

      {view === 'history' && (
        <AdminPanel title="Historique des preuves" subtitle="Paiements manuels validés ou rejetés." bodyClassName="p-2 sm:p-2">
          <ResponsiveTable<SubscriptionPaymentProof>
            rows={historyProofs}
            getKey={(proof) => proof.id}
            selectedKey={selectedProofId}
            onRowClick={onOpenProof}
            rowAriaLabel={(proof) => `Ouvrir la preuve ${proof.reference ?? proof.id}`}
            empty={<AdminEmptyState title="Historique vide" text="Les preuves traitées seront conservées ici." />}
            columns={[
              {
                key: 'org',
                label: 'Organisation',
                render: (proof) => (
                  <span className="block min-w-0">
                    <span className="block truncate text-[0.76rem] font-semibold text-slate-950">{proof.agencies?.name ?? proof.agency_id}</span>
                    <span className="block truncate text-[0.68rem] font-semibold text-slate-500">{proof.method} · {proof.reference ?? 'Sans référence'}</span>
                  </span>
                ),
              },
              { key: 'plan', label: 'Plan', hideWhenDetail: true, render: (proof) => getAdminPlan(proof.plan_key).name },
              { key: 'amount', label: 'Montant', align: 'right', render: (proof) => <span className="font-semibold">{formatAdminCurrency(proof.amount)}</span> },
              { key: 'status', label: 'Statut', render: (proof) => <AdminStatusBadge status={proof.status} /> },
              { key: 'date', label: 'Date', hideWhenDetail: true, render: (proof) => formatAdminDate(proof.created_at) },
            ]}
            renderCard={(proof) => (
              <button key={proof.id} type="button" onClick={() => onOpenProof(proof)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left">
                <div className="min-w-0">
                  <p className="truncate text-[0.78rem] font-semibold text-slate-950">{proof.agencies?.name ?? proof.agency_id}</p>
                  <p className="truncate text-xs font-semibold text-slate-500">{proof.method} · {formatAdminDate(proof.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="whitespace-nowrap text-[0.78rem] font-semibold text-slate-900">{formatAdminCurrency(proof.amount)}</p>
                  <AdminStatusBadge status={proof.status} />
                </div>
              </button>
            )}
          />
        </AdminPanel>
      )}
    </div>
  );
}
