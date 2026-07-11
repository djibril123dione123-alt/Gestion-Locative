import { AlertTriangle, Building2, CreditCard, FileText, LifeBuoy, ShieldCheck, Users } from 'lucide-react';
import { formatAdminCurrency, formatAdminDateTime } from '../../../lib/admin/adminFormatters';
import { humanizeAuditAction } from '../../../services/admin/adminAuditService';
import { AdminEmptyState, AdminMetricCard, AdminPanel, AdminStatusBadge } from '../../../components/console/AdminPrimitives';
import type { AdminAgency, AdminConsoleData } from '../../../services/admin/adminConsoleService';

export function OverviewTab({ data, onOpenAgency, onOpenProof }: {
  data: AdminConsoleData;
  onOpenAgency: (agency: AdminAgency) => void;
  onOpenProof: (proofId: string) => void;
}) {
  const expiringTrials = data.agencies.filter((agency) => {
    if (agency.status !== 'trial' || !agency.trial_ends_at) return false;
    const days = Math.ceil((new Date(agency.trial_ends_at).getTime() - Date.now()) / 86_400_000);
    return days <= 7;
  });
  const pendingProofs = data.proofs.filter((proof) => proof.status === 'pending');
  const pendingRequests = data.requests.filter((request) => request.status === 'pending');
  const actions = [
    ...pendingProofs.slice(0, 4).map((proof) => ({
      key: `proof-${proof.id}`,
      title: 'Paiement manuel à valider',
      text: `${proof.agencies?.name ?? 'Organisation'} · ${formatAdminCurrency(proof.amount)} · ${proof.method}`,
      tone: 'amber' as const,
      onClick: () => onOpenProof(proof.id),
    })),
    ...pendingRequests.slice(0, 4).map((request) => ({
      key: `request-${request.id}`,
      title: 'Demande d’intégration à examiner',
      text: `${request.organization_name ?? request.agency_name ?? request.requester_email ?? 'Nouvelle demande'} · ${request.requested_plan ?? request.plan ?? 'plan à confirmer'}`,
      tone: 'blue' as const,
      onClick: undefined,
    })),
    ...expiringTrials.slice(0, 4).map((agency) => ({
      key: `trial-${agency.id}`,
      title: 'Essai proche expiration',
      text: `${agency.name} · échéance ${formatAdminDateTime(agency.trial_ends_at)}`,
      tone: 'red' as const,
      onClick: () => onOpenAgency(agency),
    })),
  ].slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard label="Organisations" value={data.platform.totalOrganizations} helper={`${data.platform.activeOrganizations} actives`} icon={Building2} tone="emerald" />
        <AdminMetricCard label="MRR estimé" value={formatAdminCurrency(data.platform.estimatedMrr)} helper="Calcul opérationnel, non comptable" icon={CreditCard} tone="orange" />
        <AdminMetricCard label="Paiements à valider" value={data.platform.pendingProofs} helper="Preuves manuelles" icon={ShieldCheck} tone={data.platform.pendingProofs ? 'amber' : 'emerald'} />
        <AdminMetricCard label="Support ouvert" value={data.platform.openTickets} helper={`${data.platform.pendingRequests} demande(s) onboarding`} icon={LifeBuoy} tone={data.platform.openTickets ? 'amber' : 'slate'} />
        <AdminMetricCard label="Documents" value={data.platform.totalDocuments} helper={`${data.platform.documentsThisMonth} ce mois`} icon={FileText} tone="blue" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminPanel title="Actions requises" subtitle="File prioritaire pour piloter la journée.">
          {actions.length === 0 ? (
            <AdminEmptyState title="Aucune action critique détectée" text="Les paiements, demandes, essais et incidents prioritaires apparaîtront ici." />
          ) : (
            <div className="space-y-2">
              {actions.map((item) => (
                <button key={item.key} type="button" onClick={item.onClick} className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-left transition hover:bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">{item.title}</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">{item.text}</p>
                    </div>
                    <AdminStatusBadge tone={item.tone}>À traiter</AdminStatusBadge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </AdminPanel>

        <AdminPanel title="Santé plateforme" subtitle="Vue synthétique sans exposer de détails sensibles.">
          <div className="grid gap-2">
            {[
              ['App', 'Opérationnel', data.partialErrors.length === 0],
              ['Auth', 'Opérationnel', true],
              ['Documents & QR', data.platform.totalDocuments ? 'Suivi actif' : 'Instrumentation à compléter', true],
              ['Paiements', pendingProofs.length ? 'Validation requise' : 'Aucune preuve en attente', pendingProofs.length === 0],
              ['Audit', data.auditLogs.length ? 'Traçabilité active' : 'À vérifier', data.auditLogs.length > 0],
            ].map(([label, status, ok]) => (
              <div key={String(label)} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span className="text-sm font-bold text-slate-800">{label}</span>
                <AdminStatusBadge tone={ok ? 'emerald' : 'amber'}>{status}</AdminStatusBadge>
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <AdminPanel title="Santé business" subtitle="Répartition opérationnelle des comptes.">
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminMetricCard label="Essais" value={data.platform.trialOrganizations} icon={Users} tone="blue" />
            <AdminMetricCard label="Suspendues" value={data.platform.suspendedOrganizations} icon={AlertTriangle} tone={data.platform.suspendedOrganizations ? 'red' : 'slate'} />
            <AdminMetricCard label="Bailleurs individuels" value={data.platform.individualLandlords} icon={Building2} />
            <AdminMetricCard label="Utilisateurs actifs" value={data.platform.activeUsers} icon={Users} />
          </div>
        </AdminPanel>

        <AdminPanel title="Activité récente" subtitle="Actions sensibles et événements owner humanisés.">
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
