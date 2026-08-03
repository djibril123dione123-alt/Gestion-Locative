import { AlertTriangle, Building2, CreditCard, FileText, LifeBuoy, Radar, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { buildRequiredActions, summarizeSaasRevenue } from '../../../lib/admin/adminInsights';
import { formatAdminCurrency, formatAdminDateTime } from '../../../lib/admin/adminFormatters';
import { humanizeAuditAction } from '../../../services/admin/adminAuditService';
import { AdminEmptyState, AdminKpiGrid, AdminMetricCard, AdminPanel, AdminStatusBadge } from '../../../components/console/AdminPrimitives';
import type { ConsoleSpace } from '../../../lib/admin/adminNavigation';
import type { AdminAgency, AdminConsoleData } from '../../../services/admin/adminConsoleService';

export function OverviewTab({ data, onOpenAgency, onOpenProof, onNavigate }: {
  data: AdminConsoleData;
  onOpenAgency: (agency: AdminAgency) => void;
  onOpenProof: (proofId: string) => void;
  onNavigate: (space: ConsoleSpace) => void;
}) {
  const actions = buildRequiredActions(data).slice(0, 10);
  const revenue = summarizeSaasRevenue(data);
  const riskAccounts = buildRequiredActions(data).filter((action) => action.organizationId && action.priority >= 75).length;
  const verifiedQr = data.documentVerifications.filter((verification) => verification.last_verified_at || Number(verification.verification_count ?? 0) > 0).length;

  const openAction = (
    actionId: string,
    domain: string,
    organizationId?: string | null,
    targetId?: string | null,
  ) => {
    if (actionId.startsWith('proof-') && targetId) {
      onOpenProof(targetId);
      return;
    }
    if (organizationId) {
      const agency = data.agencies.find((item) => item.id === organizationId);
      if (agency) {
        onOpenAgency(agency);
        return;
      }
    }

    const destinationByDomain: Record<string, ConsoleSpace> = {
      billing: 'billing',
      documents: 'system-config',
      organization: 'organizations',
      security: 'system-config',
      support: 'support-ops',
      system: 'system-config',
    };
    onNavigate(destinationByDomain[domain] ?? 'overview');
  };

  return (
    <div className="space-y-3">
      <AdminKpiGrid maxItems={6}>
        <AdminMetricCard label="Organisations" value={data.platform.totalOrganizations} helper={`${data.platform.activeOrganizations} actives`} icon={Building2} tone="emerald" onClick={() => onNavigate('organizations')} />
        <AdminMetricCard label="MRR estimé" value={formatAdminCurrency(revenue.mrr)} helper={`${formatAdminCurrency(revenue.arr)} ARR`} icon={TrendingUp} tone="orange" onClick={() => onNavigate('billing')} />
        <AdminMetricCard label="Paiements" value={data.platform.pendingProofs} helper={`${formatAdminCurrency(revenue.pendingAmount)} en attente`} icon={CreditCard} tone={data.platform.pendingProofs ? 'amber' : 'emerald'} onClick={() => onNavigate('billing')} />
        <AdminMetricCard label="Support" value={data.platform.openTickets} helper={`${data.platform.pendingRequests} demande(s)`} icon={LifeBuoy} tone={data.platform.openTickets ? 'amber' : 'slate'} onClick={() => onNavigate('support-ops')} />
        <AdminMetricCard label="Documents" value={data.platform.totalDocuments} helper={`${data.platform.documentsThisMonth} ce mois`} icon={FileText} tone="blue" onClick={() => onNavigate('system-config')} />
        <AdminMetricCard label="QR vérifiés" value={verifiedQr} helper={`${data.documentVerifications.length} QR suivis`} icon={Radar} tone="emerald" onClick={() => onNavigate('system-config')} />
      </AdminKpiGrid>

      <div className="grid items-start gap-3 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminPanel title="À traiter maintenant" subtitle="File prioritaire construite depuis paiements, demandes, essais, support, incidents et documents.">
          {actions.length === 0 ? (
            <AdminEmptyState title="Aucune action critique détectée" text="Les paiements, demandes, essais, incidents et anomalies documentaires apparaîtront ici." />
          ) : (
            <div className="space-y-2">
              {actions.map((item) => (
                <button key={item.id} type="button" onClick={() => openAction(item.id, item.domain, item.organizationId, item.targetId)} className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-left transition hover:border-emerald-200 hover:bg-white">
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

        <AdminPanel title="Couverture opérationnelle" subtitle="Données actuellement suivies par la console propriétaire.">
          <div className="grid gap-1.5">
            {[
              { label: 'Organisations', status: `${data.agencies.length} fiches chargées`, ok: data.agencies.length > 0, target: 'organizations' as ConsoleSpace },
              { label: 'Utilisateurs', status: `${data.users.length} profils suivis`, ok: data.users.length > 0, target: 'users-access' as ConsoleSpace },
              { label: 'Documents & QR', status: `${data.documentRegistry.length} documents · ${data.documentVerifications.length} QR`, ok: true, target: 'system-config' as ConsoleSpace },
              { label: 'Paiements', status: data.platform.pendingProofs ? `${data.platform.pendingProofs} à valider` : 'Aucune preuve en attente', ok: data.platform.pendingProofs === 0, target: 'billing' as ConsoleSpace },
              { label: 'Journal administrateur', status: `${data.auditLogs.length} actions chargées`, ok: data.auditLogs.length > 0, target: 'system-config' as ConsoleSpace },
              { label: 'Comptes à risque', status: riskAccounts ? `${riskAccounts} signal(s)` : 'Aucun signal fort', ok: riskAccounts === 0, target: 'organizations' as ConsoleSpace },
            ].map(({ label, status, ok, target }) => (
              <button type="button" onClick={() => onNavigate(target)} key={label} className="flex min-h-10 items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-emerald-200 hover:bg-emerald-50/35">
                <span className="text-sm font-bold text-slate-800">{label}</span>
                <AdminStatusBadge tone={ok ? 'emerald' : 'amber'}>{status}</AdminStatusBadge>
              </button>
            ))}
          </div>
        </AdminPanel>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[0.85fr_1.15fr]">
        <AdminPanel title="Portefeuille clients" subtitle="Répartition des organisations et revenus SaaS, séparés de la finance locative.">
          <AdminKpiGrid maxItems={4}>
            <AdminMetricCard label="Essais" value={data.platform.trialOrganizations} helper="À convertir" icon={Users} tone="blue" onClick={() => onNavigate('organizations')} />
            <AdminMetricCard label="Suspendues" value={data.platform.suspendedOrganizations} helper="À suivre" icon={AlertTriangle} tone={data.platform.suspendedOrganizations ? 'red' : 'slate'} onClick={() => onNavigate('organizations')} />
            <AdminMetricCard label="Bailleurs individuels" value={data.platform.individualLandlords} helper="Profils propriétaires" icon={Building2} onClick={() => onNavigate('organizations')} />
            <AdminMetricCard label="Clients payants" value={revenue.payingClients} helper="Abonnements actifs" icon={ShieldCheck} tone="emerald" onClick={() => onNavigate('billing')} />
          </AdminKpiGrid>
          <div className="mt-3 grid gap-2">
            {revenue.byPlan.map(({ plan, count, revenue: planRevenue }) => (
              <button type="button" onClick={() => onNavigate('billing')} key={plan.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-emerald-200 hover:bg-emerald-50/35">
                <span className="text-sm font-black text-slate-900">{plan.name}</span>
                <span className="text-xs font-bold text-slate-500">{count} client(s) · {formatAdminCurrency(planRevenue)}</span>
              </button>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="Activité récente" subtitle="Actions sensibles, notes et événements de la console.">
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
