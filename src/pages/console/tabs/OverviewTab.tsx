import { AlertTriangle, Building2, CreditCard, FileText, LifeBuoy, Radar, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { buildRequiredActions, summarizeSaasRevenue } from '../../../lib/admin/adminInsights';
import { formatAdminCurrency, formatAdminDateTime } from '../../../lib/admin/adminFormatters';
import { humanizeAuditAction } from '../../../services/admin/adminAuditService';
import { AdminEmptyState, AdminMetricCard, AdminPanel, AdminStatusBadge } from '../../../components/console/AdminPrimitives';
import type { AdminAgency, AdminConsoleData } from '../../../services/admin/adminConsoleService';

export function OverviewTab({ data, onOpenAgency, onOpenProof }: {
  data: AdminConsoleData;
  onOpenAgency: (agency: AdminAgency) => void;
  onOpenProof: (proofId: string) => void;
}) {
  const actions = buildRequiredActions(data).slice(0, 10);
  const revenue = summarizeSaasRevenue(data);
  const riskAccounts = buildRequiredActions(data).filter((action) => action.organizationId && action.priority >= 75).length;
  const verifiedQr = data.documentVerifications.filter((verification) => verification.last_verified_at || Number(verification.verification_count ?? 0) > 0).length;

  const openAction = (actionId: string, organizationId?: string | null, targetId?: string | null) => {
    if (actionId.startsWith('proof-') && targetId) {
      onOpenProof(targetId);
      return;
    }
    if (organizationId) {
      const agency = data.agencies.find((item) => item.id === organizationId);
      if (agency) onOpenAgency(agency);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <AdminMetricCard label="Organisations" value={data.platform.totalOrganizations} helper={`${data.platform.activeOrganizations} actives`} icon={Building2} tone="emerald" />
        <AdminMetricCard label="MRR estimé" value={formatAdminCurrency(revenue.mrr)} helper={`${formatAdminCurrency(revenue.arr)} ARR`} icon={TrendingUp} tone="orange" />
        <AdminMetricCard label="Paiements" value={data.platform.pendingProofs} helper={`${formatAdminCurrency(revenue.pendingAmount)} en attente`} icon={CreditCard} tone={data.platform.pendingProofs ? 'amber' : 'emerald'} />
        <AdminMetricCard label="Support" value={data.platform.openTickets} helper={`${data.platform.pendingRequests} demande(s)`} icon={LifeBuoy} tone={data.platform.openTickets ? 'amber' : 'slate'} />
        <AdminMetricCard label="Documents" value={data.platform.totalDocuments} helper={`${data.platform.documentsThisMonth} ce mois`} icon={FileText} tone="blue" />
        <AdminMetricCard label="QR vérifiés" value={verifiedQr} helper={`${data.documentVerifications.length} QR suivis`} icon={Radar} tone="emerald" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminPanel title="À traiter maintenant" subtitle="File prioritaire construite depuis paiements, demandes, essais, support, incidents et documents.">
          {actions.length === 0 ? (
            <AdminEmptyState title="Aucune action critique détectée" text="Les paiements, demandes, essais, incidents et anomalies documentaires apparaîtront ici." />
          ) : (
            <div className="space-y-2">
              {actions.map((item) => (
                <button key={item.id} type="button" onClick={() => openAction(item.id, item.organizationId, item.targetId)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-left transition hover:bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-slate-500">{item.description}</p>
                    </div>
                    <AdminStatusBadge tone={item.tone}>{item.domain}</AdminStatusBadge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </AdminPanel>

        <AdminPanel title="Santé plateforme" subtitle="Statuts synthétiques sans exposer de secrets ni stack traces.">
          <div className="grid gap-2">
            {[
              ['App', data.partialErrors.length === 0 ? 'Opérationnel' : 'À vérifier', data.partialErrors.length === 0],
              ['Auth', 'Opérationnel', true],
              ['Documents & QR', data.platform.totalDocuments ? 'Suivi actif' : 'Instrumentation à compléter', true],
              ['Paiements', data.platform.pendingProofs ? 'Validation requise' : 'À jour', data.platform.pendingProofs === 0],
              ['Audit', data.auditLogs.length ? 'Traçabilité active' : 'À vérifier', data.auditLogs.length > 0],
              ['Comptes à risque', riskAccounts ? `${riskAccounts} signal(s)` : 'Aucun signal fort', riskAccounts === 0],
            ].map(([label, status, ok]) => (
              <div key={String(label)} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span className="text-sm font-bold text-slate-800">{label}</span>
                <AdminStatusBadge tone={ok ? 'emerald' : 'amber'}>{status}</AdminStatusBadge>
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <AdminPanel title="Santé business" subtitle="Répartition opérationnelle et revenus SaaS, séparés de la finance locative.">
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminMetricCard label="Essais" value={data.platform.trialOrganizations} icon={Users} tone="blue" />
            <AdminMetricCard label="Suspendues" value={data.platform.suspendedOrganizations} icon={AlertTriangle} tone={data.platform.suspendedOrganizations ? 'red' : 'slate'} />
            <AdminMetricCard label="Bailleurs individuels" value={data.platform.individualLandlords} icon={Building2} />
            <AdminMetricCard label="Clients payants" value={revenue.payingClients} icon={ShieldCheck} tone="emerald" />
          </div>
          <div className="mt-3 grid gap-2">
            {revenue.byPlan.map(({ plan, count, revenue: planRevenue }) => (
              <div key={plan.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span className="text-sm font-black text-slate-900">{plan.name}</span>
                <span className="text-xs font-bold text-slate-500">{count} client(s) · {formatAdminCurrency(planRevenue)}</span>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="Activité récente" subtitle="Actions sensibles, notes et événements owner humanisés.">
          {data.auditLogs.length === 0 ? (
            <AdminEmptyState title="Aucune action récente" text="Les validations, changements de plan et actions sensibles seront listés ici." />
          ) : (
            <div className="space-y-2">
              {data.auditLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-900">{humanizeAuditAction(log.action)}</p>
                    <span className="text-xs font-semibold text-slate-400">{formatAdminDateTime(log.created_at)}</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{log.target_label ?? log.target_type ?? 'Plateforme'}{log.reason ? ` · ${log.reason}` : ''}</p>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
