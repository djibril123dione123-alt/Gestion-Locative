import { useMemo, useState } from 'react';
import { Bell, Database, FileText, Flag, Megaphone, QrCode, ShieldCheck, Wrench } from 'lucide-react';
import { documentTypeLabel } from '../../../lib/admin/adminInsights';
import { formatAdminDateTime } from '../../../lib/admin/adminFormatters';
import { humanizeAuditAction } from '../../../services/admin/adminAuditService';
import { AdminButton, AdminEmptyState, AdminKpiGrid, AdminMetricCard, AdminPanel, AdminStatusBadge } from '../../../components/console/AdminPrimitives';
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

export function SystemConfigTab({
  data,
  onToggleFlag,
  onCreateAnnouncement,
  onOpenAgencyById,
}: {
  data: AdminConsoleData;
  onToggleFlag: (flag: AdminFeatureFlag, active: boolean) => void;
  onCreateAnnouncement: (title: string, message: string, status: string) => void;
  onOpenAgencyById?: (agencyId: string | null | undefined) => void;
}) {
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementStatus, setAnnouncementStatus] = useState('draft');
  const activeFlags = data.featureFlags.filter(flagActive).length;

  const documentIssues = useMemo(() => (
    data.documentRegistry.filter((entry) => !entry.storage_path || ['failed', 'error', 'draft'].includes(entry.status ?? ''))
  ), [data.documentRegistry]);
  const verifiedQr = data.documentVerifications.filter((verification) => verification.last_verified_at || Number(verification.verification_count ?? 0) > 0);
  const openIncidents = data.incidents.filter((incident) => !['resolved', 'ignored'].includes(incident.status ?? ''));

  const submitAnnouncement = () => {
    onCreateAnnouncement(announcementTitle.trim(), announcementMessage.trim(), announcementStatus);
    setAnnouncementTitle('');
    setAnnouncementMessage('');
    setAnnouncementStatus('draft');
  };

  const healthRows = [
    ['Application', data.partialErrors.length ? 'À vérifier' : 'Opérationnel', data.partialErrors.length ? 'amber' : 'emerald'],
    ['Supabase Auth', 'Opérationnel', 'emerald'],
    ['Storage', data.documentRegistry.some((doc) => doc.storage_path) ? 'Suivi actif' : 'À instrumenter', data.documentRegistry.some((doc) => doc.storage_path) ? 'emerald' : 'slate'],
    ['Documents PDF', data.documentRegistry.length ? 'Registry actif' : 'Aucun document à vérifier', data.documentRegistry.length ? 'emerald' : 'slate'],
    ['Paiements', data.platform.pendingProofs ? 'Validation requise' : 'Aucun blocage détecté', data.platform.pendingProofs ? 'amber' : 'emerald'],
    ['Audit owner', data.auditLogs.length ? 'Traçabilité active' : 'À vérifier', data.auditLogs.length ? 'emerald' : 'amber'],
  ] as const;

  return (
    <div className="space-y-3">
      <AdminKpiGrid maxItems={5}>
        <AdminMetricCard label="Documents" value={data.documentRegistry.length || data.platform.totalDocuments} helper={`${documentIssues.length} à vérifier`} icon={FileText} tone={documentIssues.length ? 'amber' : 'blue'} />
        <AdminMetricCard label="QR Verify" value={verifiedQr.length} helper={`${data.documentVerifications.length} suivis`} icon={QrCode} tone="emerald" />
        <AdminMetricCard label="Incidents" value={openIncidents.length} helper="Ouverts" icon={Wrench} tone={openIncidents.length ? 'red' : 'emerald'} />
        <AdminMetricCard label="Flags" value={activeFlags} helper="Actifs" icon={Flag} tone={activeFlags ? 'amber' : 'slate'} />
        <AdminMetricCard label="Audit" value={data.auditLogs.length} helper="Actions" icon={ShieldCheck} />
      </AdminKpiGrid>

      <AdminPanel title="Santé système" subtitle="Statuts synthétiques sans exposer de secret, token ou stack trace.">
        <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
          {healthRows.map(([label, value, tone]) => (
            <div key={label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
              <span className="text-sm font-bold text-slate-800">{label}</span>
              <AdminStatusBadge tone={tone}>{value}</AdminStatusBadge>
            </div>
          ))}
        </div>
      </AdminPanel>

      <div className="grid items-start gap-3 2xl:grid-cols-[0.95fr_1.05fr]">
        <AdminPanel title="Communication plateforme" subtitle="Annonces maintenance, incidents planifiés et messages owner.">
          <div className="grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                <input
                  value={announcementTitle}
                  onChange={(event) => setAnnouncementTitle(event.target.value)}
                  placeholder="Titre de l’annonce..."
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none"
                />
                <select
                  value={announcementStatus}
                  onChange={(event) => setAnnouncementStatus(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                >
                  <option value="draft">Brouillon</option>
                  <option value="scheduled">Planifiée</option>
                  <option value="active">Active</option>
                </select>
              </div>
              <textarea
                value={announcementMessage}
                onChange={(event) => setAnnouncementMessage(event.target.value)}
                rows={3}
                placeholder="Message court et lisible côté exploitation..."
                className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none"
              />
              <div className="mt-2 flex justify-end">
                <AdminButton variant="primary" disabled={announcementTitle.trim().length < 3 || announcementMessage.trim().length < 8} onClick={submitAnnouncement}>
                  <Megaphone className="h-3.5 w-3.5" />
                  Créer annonce
                </AdminButton>
              </div>
            </div>

            {data.announcements.length === 0 ? (
              <AdminEmptyState title="Aucune annonce plateforme" text="Les annonces maintenance ou messages owner apparaîtront ici." />
            ) : (
              <div className="grid gap-2">
                {data.announcements.slice(0, 6).map((announcement) => (
                  <div key={announcement.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-slate-950">{announcement.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{announcement.message}</p>
                      </div>
                      <AdminStatusBadge status={announcement.status}>{announcement.status ?? 'draft'}</AdminStatusBadge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </AdminPanel>

        <AdminPanel title="Documents & QR Verify" subtitle="Supervision du registry documentaire, reliée aux fiches organisations.">
          <div className="grid gap-3 2xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Registry documents</p>
                <AdminStatusBadge tone={documentIssues.length ? 'amber' : 'emerald'}>{documentIssues.length ? 'À vérifier' : 'Stable'}</AdminStatusBadge>
              </div>
              <div className="space-y-2">
                {(documentIssues.length ? documentIssues : data.documentRegistry).slice(0, 6).map((entry) => (
                  <button key={entry.id} type="button" onClick={() => onOpenAgencyById?.(entry.agency_id)} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left transition hover:border-emerald-200 hover:bg-emerald-50/45">
                    <p className="text-sm font-black text-slate-900">{documentTypeLabel(entry.document_type)}</p>
                    <p className="text-xs font-semibold text-slate-500">{entry.agencies?.name ?? 'Organisation'} · {entry.reference ?? 'sans référence'} · {entry.status ?? 'statut inconnu'}</p>
                  </button>
                ))}
                {data.documentRegistry.length === 0 && <p className="text-xs font-semibold text-slate-500">Aucune entrée registry chargée.</p>}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Vérifications QR</p>
                <AdminStatusBadge tone="blue">{verifiedQr.length} vérifiées</AdminStatusBadge>
              </div>
              <div className="space-y-2">
                {data.documentVerifications.slice(0, 6).map((verification) => (
                  <button key={verification.id} type="button" onClick={() => onOpenAgencyById?.(verification.agency_id)} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left transition hover:border-emerald-200 hover:bg-emerald-50/45">
                    <p className="text-sm font-black text-slate-900">{documentTypeLabel(verification.document_type)}</p>
                    <p className="text-xs font-semibold text-slate-500">{verification.agencies?.name ?? 'Organisation'} · {verification.verification_count ?? 0} vérification(s) · {formatAdminDateTime(verification.last_verified_at)}</p>
                  </button>
                ))}
                {data.documentVerifications.length === 0 && <p className="text-xs font-semibold text-slate-500">Aucun QR suivi chargé.</p>}
              </div>
            </div>
          </div>
        </AdminPanel>
      </div>

      <div className="grid items-start gap-3 2xl:grid-cols-2">
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

      <div className="grid items-start gap-3 2xl:grid-cols-[0.9fr_1.1fr]">
        <AdminPanel title="Événements système" subtitle="Journal lisible des signaux plateforme récents.">
          {data.systemEvents.length === 0 && data.notifications.length === 0 ? (
            <AdminEmptyState title="Aucun événement chargé" text="Les signaux système et notifications admin apparaîtront ici." />
          ) : (
            <div className="grid gap-2">
              {data.notifications.slice(0, 6).map((notification) => (
                <div key={notification.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-start gap-2">
                    <Bell className="mt-0.5 h-4 w-4 text-amber-700" />
                    <div>
                      <p className="text-sm font-black text-slate-950">{notification.title}</p>
                      <p className="text-xs font-semibold text-slate-500">{notification.message ?? 'Notification admin'} · {formatAdminDateTime(notification.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {data.systemEvents.slice(0, 8).map((event) => (
                <div key={event.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-sm font-black text-slate-950">{event.event_type}</p>
                  <p className="text-xs font-semibold text-slate-500">{event.message} · {formatAdminDateTime(event.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>

        <AdminPanel title="Audit log" subtitle="Actions sensibles humanisées. Les détails techniques restent hors table principale.">
          {data.auditLogs.length === 0 ? (
            <AdminEmptyState title="Audit vide" text="Les actions sensibles écrites par la console apparaîtront ici." />
          ) : (
            <div className="space-y-2">
              {data.auditLogs.slice(0, 20).map((log) => (
                <div key={log.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 md:grid-cols-[1fr_160px_130px] md:items-center">
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
      </div>

      <AdminPanel title="Modules globaux" subtitle="Lecture owner : la configuration détaillée reste gouvernée par type de compte et feature flags.">
        <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-5">
          {['Portefeuille locatif', 'Finance SaaS', 'Documents & QR', 'Support', 'Audit'].map((module) => (
            <div key={module} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <Database className="mb-2 h-4 w-4 text-emerald-800" />
              <p className="text-sm font-black text-slate-900">{module}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Instrumentation active.</p>
            </div>
          ))}
        </div>
      </AdminPanel>
    </div>
  );
}
