import { Database, FileText, Flag, QrCode, ShieldCheck, Wrench } from 'lucide-react';
import { formatAdminDateTime } from '../../../lib/admin/adminFormatters';
import { humanizeAuditAction } from '../../../services/admin/adminAuditService';
import { AdminEmptyState, AdminMetricCard, AdminPanel, AdminStatusBadge } from '../../../components/console/AdminPrimitives';
import type { AdminConsoleData, AdminFeatureFlag } from '../../../services/admin/adminConsoleService';

function flagKey(flag: AdminFeatureFlag) {
  return flag.key ?? flag.flag ?? flag.flag_name ?? 'feature_flag';
}

function flagActive(flag: AdminFeatureFlag) {
  return flag.enabled === true || flag.status === 'active' || flag.status === 'testing';
}

function configPreview(value: unknown) {
  if (value == null) return 'Non renseigné';
  if (typeof value === 'string') return value.length > 80 ? `${value.slice(0, 80)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return 'JSON configuré';
}

export function SystemConfigTab({ data, onToggleFlag }: { data: AdminConsoleData; onToggleFlag: (flag: AdminFeatureFlag, active: boolean) => void }) {
  const activeFlags = data.featureFlags.filter(flagActive).length;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard label="Documents" value={data.platform.totalDocuments} helper={`${data.platform.documentsThisMonth} ce mois`} icon={FileText} tone="blue" />
        <AdminMetricCard label="QR Verify" value="Suivi actif" helper="Métadonnées uniquement" icon={QrCode} />
        <AdminMetricCard label="Incidents ouverts" value={data.platform.openIncidents} icon={Wrench} tone={data.platform.openIncidents ? 'red' : 'emerald'} />
        <AdminMetricCard label="Flags actifs" value={activeFlags} icon={Flag} tone={activeFlags ? 'amber' : 'slate'} />
        <AdminMetricCard label="Audit" value={data.auditLogs.length} helper="Actions récentes" icon={ShieldCheck} />
      </div>

      <AdminPanel title="Santé système" subtitle="Statuts synthétiques sans exposer de secret ni stack trace.">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {[
            ['Application', data.partialErrors.length ? 'À vérifier' : 'Opérationnel', data.partialErrors.length ? 'amber' : 'emerald'],
            ['Supabase Auth', 'Opérationnel', 'emerald'],
            ['Storage', 'Suivi à compléter', 'slate'],
            ['Documents PDF', data.platform.totalDocuments ? 'Suivi actif' : 'Donnée non disponible', data.platform.totalDocuments ? 'emerald' : 'slate'],
            ['Paiements', data.platform.pendingProofs ? 'Validation requise' : 'Aucun blocage détecté', data.platform.pendingProofs ? 'amber' : 'emerald'],
            ['Audit owner', data.auditLogs.length ? 'Traçabilité active' : 'À vérifier', data.auditLogs.length ? 'emerald' : 'amber'],
          ].map(([label, value, tone]) => (
            <div key={label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
              <span className="text-sm font-bold text-slate-800">{label}</span>
              <AdminStatusBadge tone={tone as 'emerald' | 'amber' | 'slate'}>{value}</AdminStatusBadge>
            </div>
          ))}
        </div>
      </AdminPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <AdminPanel title="Feature flags" subtitle="Activation contrôlée avec audit. Les flags archivés restent visibles mais non modifiables.">
          {data.featureFlags.length === 0 ? (
            <AdminEmptyState title="Aucun feature flag actif" text="Les flags globaux ou ciblés apparaîtront ici avec leur état." />
          ) : (
            <div className="grid gap-2">
              {data.featureFlags.slice(0, 14).map((flag) => {
                const active = flagActive(flag);
                const archived = flag.status === 'archived' || flag.status === 'deprecated';
                return (
                  <div key={flag.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-black text-slate-900">{flagKey(flag)}</p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{flag.description ?? flag.name ?? 'Description à compléter'}</p>
                      </div>
                      <AdminStatusBadge status={active ? 'active' : 'draft'}>{active ? 'Actif' : 'Inactif'}</AdminStatusBadge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                      <p className="text-[0.68rem] font-bold text-slate-500">
                        {flag.owner ? `Owner ${flag.owner}` : 'Owner non défini'}
                        {flag.expires_at ? ` · expire ${formatAdminDateTime(flag.expires_at)}` : ''}
                      </p>
                      <button
                        type="button"
                        disabled={archived}
                        onClick={() => onToggleFlag(flag, !active)}
                        className="rounded-xl border border-emerald-900/15 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        {archived ? 'Archivé' : active ? 'Désactiver' : 'Activer'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AdminPanel>

        <AdminPanel title="Configuration plateforme" subtitle="Lecture typée des clés globales. Les valeurs sensibles ne sont jamais exposées.">
          {data.configRows.length === 0 ? (
            <AdminEmptyState title="Configuration globale non initialisée" text="La console reste exploitable avec les données opérationnelles chargées." />
          ) : (
            <div className="grid gap-2">
              {data.configRows.slice(0, 10).map((row) => (
                <div key={row.key} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs font-black text-slate-900">{row.key}</p>
                    <AdminStatusBadge tone="slate">Typée</AdminStatusBadge>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{row.description ?? 'Paramètre plateforme'}</p>
                  <p className="mt-1 rounded-xl bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700">{configPreview(row.value)}</p>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>
      </div>

      <AdminPanel title="Audit log" subtitle="Actions sensibles humanisées. Les détails techniques restent hors table principale.">
        {data.auditLogs.length === 0 ? (
          <AdminEmptyState title="Audit vide" text="Les actions sensibles écrites par la console apparaîtront ici." />
        ) : (
          <div className="space-y-2">
            {data.auditLogs.slice(0, 20).map((log) => (
              <div key={log.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 md:grid-cols-[1fr_180px_150px] md:items-center">
                <div>
                  <p className="text-sm font-black text-slate-950">{humanizeAuditAction(log.action)}</p>
                  <p className="text-xs font-semibold text-slate-500">{log.target_label ?? log.target_type ?? 'Plateforme'}{log.reason ? ` · ${log.reason}` : ''}</p>
                </div>
                <span className="text-xs font-bold text-slate-500">{formatAdminDateTime(log.created_at)}</span>
                <AdminStatusBadge tone="emerald">Traçable</AdminStatusBadge>
              </div>
            ))}
          </div>
        )}
      </AdminPanel>

      <AdminPanel title="Modules globaux" subtitle="Lecture owner : la configuration détaillée reste gouvernée par type de compte.">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {['Portefeuille locatif', 'Finance SaaS', 'Documents & QR', 'Support', 'Audit'].map((module) => (
            <div key={module} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <Database className="mb-2 h-4 w-4 text-emerald-800" />
              <p className="text-sm font-black text-slate-900">{module}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Supervision active selon instrumentation disponible.</p>
            </div>
          ))}
        </div>
      </AdminPanel>
    </div>
  );
}
