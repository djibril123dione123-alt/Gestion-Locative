import { useMemo, useState } from 'react';
import { Bell, Building2, CreditCard, FileText, Flag, Headphones, Megaphone, QrCode, ShieldCheck, Wrench } from 'lucide-react';
import { documentTypeLabel } from '../../../lib/admin/adminInsights';
import { formatAdminDateTime } from '../../../lib/admin/adminFormatters';
import { humanizeAuditAction } from '../../../services/admin/adminAuditService';
import {
  AdminButton,
  AdminEmptyState,
  AdminKpiGrid,
  AdminMetricCard,
  AdminPanel,
  AdminSectionTabs,
  AdminStatusBadge,
} from '../../../components/console/AdminPrimitives';
import { SmartCombobox } from '../../../components/ui/SmartCombobox';
import type { AdminConsoleData, AdminFeatureFlag } from '../../../services/admin/adminConsoleService';

type SystemView = 'health' | 'communications' | 'documents' | 'governance';

const fieldClass = 'h-9 w-full rounded-[0.7rem] border border-slate-200 bg-[#fffdf8] px-3 text-[0.78rem] font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10';

function flagKey(flag: AdminFeatureFlag) {
  return flag.key ?? flag.flag ?? flag.flag_name ?? 'feature_flag';
}

function flagActive(flag: AdminFeatureFlag) {
  return flag.enabled === true || flag.status === 'active' || flag.status === 'testing';
}

const CONFIG_LABELS: Record<string, string> = {
  contact: 'Coordonnées de support',
  maintenance_mode: 'Mode maintenance',
  trial_days: "Durée de l'essai",
};

const CONFIG_DESCRIPTIONS: Record<string, string> = {
  contact: "Coordonnées affichées aux clients lorsqu'ils sollicitent l'assistance.",
  maintenance_mode: "Information de maintenance appliquée à l'échelle de la plateforme.",
  trial_days: 'Durée proposée par défaut aux nouvelles organisations.',
};

function configLabel(key: string) {
  return CONFIG_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function configDescription(key: string) {
  return CONFIG_DESCRIPTIONS[key] ?? 'Paramètre global appliqué par la plateforme.';
}

function configValueType(value: unknown) {
  if (typeof value === 'boolean') return 'Activation';
  if (typeof value === 'number') return 'Nombre';
  if (typeof value === 'string') return 'Texte';
  return 'Configuration';
}

function configPreview(value: unknown) {
  if (value == null) return 'Non renseigné';
  if (typeof value === 'string') return value.length > 80 ? `${value.slice(0, 80)}...` : value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Activé' : 'Désactivé';
  return 'Coordonnées configurées';
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
  const [view, setView] = useState<SystemView>('health');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementStatus, setAnnouncementStatus] = useState('draft');

  const activeFlags = data.featureFlags.filter(flagActive).length;
  const documentIssues = useMemo(
    () => data.documentRegistry.filter((entry) => !entry.storage_path || ['failed', 'error', 'draft'].includes(entry.status ?? '')),
    [data.documentRegistry],
  );
  const verifiedQr = data.documentVerifications.filter((verification) => verification.last_verified_at || Number(verification.verification_count ?? 0) > 0);
  const openIncidents = data.incidents.filter((incident) => !['resolved', 'ignored'].includes(incident.status ?? ''));

  const submitAnnouncement = () => {
    if (announcementTitle.trim().length < 3 || announcementMessage.trim().length < 8) return;
    onCreateAnnouncement(announcementTitle.trim(), announcementMessage.trim(), announcementStatus);
    setAnnouncementTitle('');
    setAnnouncementMessage('');
    setAnnouncementStatus('draft');
  };

  const healthRows = [
    ['Organisations', data.agencies.length ? `${data.agencies.length} chargées` : 'Aucune donnée chargée', data.agencies.length ? 'emerald' : 'amber'],
    ['Utilisateurs', data.users.length ? `${data.users.length} profils suivis` : 'Aucun profil chargé', data.users.length ? 'emerald' : 'amber'],
    ['Stockage documentaire', data.documentRegistry.some((doc) => doc.storage_path) ? 'Suivi actif' : 'Aucun document archivé', data.documentRegistry.some((doc) => doc.storage_path) ? 'emerald' : 'slate'],
    ['Documents PDF', data.documentRegistry.length ? 'Registre alimenté' : 'Aucune entrée', data.documentRegistry.length ? 'emerald' : 'slate'],
    ['Paiements', data.platform.pendingProofs ? 'Validation requise' : 'À jour', data.platform.pendingProofs ? 'amber' : 'emerald'],
    ['Journal administrateur', data.auditLogs.length ? `${data.auditLogs.length} actions chargées` : 'Aucune action chargée', data.auditLogs.length ? 'emerald' : 'slate'],
  ] as const;

  const modules = [
    { label: 'Portefeuille locatif', helper: `${data.agencies.length} organisations suivies`, icon: Building2, onClick: () => { window.location.hash = '/console/organizations'; } },
    { label: 'Finance SaaS', helper: `${data.subscriptions.length} abonnements suivis`, icon: CreditCard, onClick: () => { window.location.hash = '/console/billing'; } },
    { label: 'Documents & QR', helper: `${data.documentRegistry.length} documents enregistrés`, icon: FileText, onClick: () => setView('documents') },
    { label: 'Support', helper: `${openIncidents.length} incident(s) ouvert(s)`, icon: Headphones, onClick: () => { window.location.hash = '/console/support-ops'; } },
    { label: 'Audit', helper: `${data.auditLogs.length} action(s) tracée(s)`, icon: ShieldCheck, onClick: () => setView('governance') },
  ];

  return (
    <div className="space-y-3">
      <AdminKpiGrid maxItems={5}>
        <AdminMetricCard label="Documents" value={data.documentRegistry.length || data.platform.totalDocuments} helper={`${documentIssues.length} à vérifier`} icon={FileText} tone={documentIssues.length ? 'amber' : 'blue'} onClick={() => setView('documents')} />
        <AdminMetricCard label="QR Verify" value={verifiedQr.length} helper={`${data.documentVerifications.length} suivis`} icon={QrCode} tone="emerald" onClick={() => setView('documents')} />
        <AdminMetricCard label="Incidents" value={openIncidents.length} helper="Ouverts" icon={Wrench} tone={openIncidents.length ? 'red' : 'emerald'} onClick={() => { window.location.hash = '/console/support-ops'; }} />
        <AdminMetricCard label="Fonctions" value={activeFlags} helper="Pilotées" icon={Flag} tone={activeFlags ? 'amber' : 'slate'} onClick={() => setView('governance')} />
        <AdminMetricCard label="Audit" value={data.auditLogs.length} helper="Actions tracées" icon={ShieldCheck} onClick={() => setView('governance')} />
      </AdminKpiGrid>

      <AdminSectionTabs
        value={view}
        onChange={(next) => setView(next as SystemView)}
        items={[
          { value: 'health', label: 'Santé' },
          { value: 'communications', label: 'Communication', count: data.announcements.length },
          { value: 'documents', label: 'Documents & QR', count: documentIssues.length },
          { value: 'governance', label: 'Gouvernance', count: activeFlags },
        ]}
        ariaLabel="Espaces système"
      />

      {view === 'health' && (
        <>
          <AdminPanel title="Santé système" subtitle="Indicateurs factuels issus des sources chargées, sans exposer de secret ni de trace technique.">
            <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
              {healthRows.map(([label, value, tone]) => (
                <div key={label} className="flex min-h-10 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <span className="text-[0.78rem] font-bold text-slate-800">{label}</span>
                  <AdminStatusBadge tone={tone}>{value}</AdminStatusBadge>
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel title="Modules supervisés" subtitle="Ouvrez directement l’espace opérationnel correspondant.">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {modules.map(({ label, helper, icon: Icon, onClick }) => (
                <button key={label} type="button" onClick={onClick} className="group flex min-h-20 items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-emerald-300 hover:bg-emerald-50/45">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 transition group-hover:bg-emerald-100">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.78rem] font-black text-slate-950">{label}</span>
                    <span className="mt-0.5 block text-[0.66rem] font-semibold leading-4 text-slate-500">{helper}</span>
                  </span>
                </button>
              ))}
            </div>
          </AdminPanel>
        </>
      )}

      {view === 'communications' && (
        <div className="grid items-start gap-3 xl:grid-cols-[0.8fr_1.2fr]">
          <AdminPanel title="Nouvelle annonce" subtitle="Préparez un message plateforme lisible côté exploitation.">
            <div className="grid gap-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
                <input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} placeholder="Titre de l’annonce" className={fieldClass} />
                <SmartCombobox
                  value={announcementStatus}
                  onChange={setAnnouncementStatus}
                  options={[
                    { value: 'draft', label: 'Brouillon', subtitle: 'Non visible côté client' },
                    { value: 'scheduled', label: 'Planifiée', subtitle: 'Publication programmée' },
                    { value: 'active', label: 'Active', subtitle: 'Visible sur la plateforme' },
                  ]}
                  density="compact"
                  fullWidth
                />
              </div>
              <textarea value={announcementMessage} onChange={(event) => setAnnouncementMessage(event.target.value)} rows={4} placeholder="Message court et lisible" className={`${fieldClass} h-auto min-h-[6rem] resize-none py-2`} />
              <div className="flex justify-end">
                <AdminButton variant="primary" disabled={announcementTitle.trim().length < 3 || announcementMessage.trim().length < 8} onClick={submitAnnouncement}>
                  <Megaphone className="h-3.5 w-3.5" />
                  Créer l’annonce
                </AdminButton>
              </div>
            </div>
          </AdminPanel>

          <AdminPanel title="Communication plateforme" subtitle="Annonces, notifications et signaux récents.">
            {data.announcements.length === 0 && data.notifications.length === 0 && data.systemEvents.length === 0 ? (
              <AdminEmptyState title="Aucune communication enregistrée" text="Les annonces et notifications administrateur apparaîtront ici." />
            ) : (
              <div className="grid gap-1.5">
                {data.announcements.slice(0, 8).map((announcement) => (
                  <div key={announcement.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[0.78rem] font-black text-slate-950">{announcement.title}</p>
                      <p className="line-clamp-1 text-[0.68rem] font-semibold text-slate-500">{announcement.message}</p>
                    </div>
                    <AdminStatusBadge status={announcement.status}>{announcement.status ?? 'draft'}</AdminStatusBadge>
                  </div>
                ))}
                {data.notifications.slice(0, 6).map((notification) => (
                  <div key={notification.id} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <div className="min-w-0">
                      <p className="truncate text-[0.78rem] font-black text-slate-950">{notification.title}</p>
                      <p className="line-clamp-1 text-[0.68rem] font-semibold text-slate-500">{notification.message ?? 'Notification admin'} · {formatAdminDateTime(notification.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminPanel>
        </div>
      )}

      {view === 'documents' && (
        <AdminPanel title="Documents & QR Verify" subtitle="Registre documentaire et vérifications reliés aux fiches organisations.">
          <div className="grid gap-3 xl:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-slate-50/55 p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.1em] text-slate-500">Registre documentaire</p>
                <AdminStatusBadge tone={documentIssues.length ? 'amber' : 'emerald'}>{documentIssues.length ? 'À vérifier' : 'Stable'}</AdminStatusBadge>
              </div>
              <div className="grid gap-1.5">
                {(documentIssues.length ? documentIssues : data.documentRegistry).slice(0, 12).map((entry) => (
                  <button key={entry.id} type="button" onClick={() => onOpenAgencyById?.(entry.agency_id)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-emerald-200 hover:bg-emerald-50/45">
                    <p className="text-[0.78rem] font-black text-slate-900">{documentTypeLabel(entry.document_type)}</p>
                    <p className="truncate text-[0.67rem] font-semibold text-slate-500">{entry.agencies?.name ?? 'Organisation'} · {entry.reference ?? 'Sans référence'} · {entry.status ?? 'Statut inconnu'}</p>
                  </button>
                ))}
                {data.documentRegistry.length === 0 && <AdminEmptyState title="Registre vide" text="Les documents archivés apparaîtront ici." />}
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-slate-50/55 p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.1em] text-slate-500">Vérifications QR</p>
                <AdminStatusBadge tone="blue">{verifiedQr.length} vérifiées</AdminStatusBadge>
              </div>
              <div className="grid gap-1.5">
                {data.documentVerifications.slice(0, 12).map((verification) => (
                  <button key={verification.id} type="button" onClick={() => onOpenAgencyById?.(verification.agency_id)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-emerald-200 hover:bg-emerald-50/45">
                    <p className="text-[0.78rem] font-black text-slate-900">{documentTypeLabel(verification.document_type)}</p>
                    <p className="truncate text-[0.67rem] font-semibold text-slate-500">{verification.agencies?.name ?? 'Organisation'} · {verification.verification_count ?? 0} vérification(s) · {formatAdminDateTime(verification.last_verified_at)}</p>
                  </button>
                ))}
                {data.documentVerifications.length === 0 && <AdminEmptyState title="Aucune vérification QR" text="Les consultations de QR Verify apparaîtront ici." />}
              </div>
            </section>
          </div>
        </AdminPanel>
      )}

      {view === 'governance' && (
        <div className="grid items-start gap-3 xl:grid-cols-2">
          <AdminPanel title="Fonctionnalités pilotées" subtitle="Activation contrôlée et auditée. Les fonctionnalités archivées restent en lecture.">
            {data.featureFlags.length === 0 ? (
              <AdminEmptyState title="Aucune fonctionnalité pilotée" text="Les activations globales ou ciblées apparaîtront ici." />
            ) : (
              <div className="grid gap-1.5">
                {data.featureFlags.slice(0, 16).map((flag) => {
                  const active = flagActive(flag);
                  const archived = flag.status === 'archived' || flag.status === 'deprecated';
                  return (
                    <div key={flag.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[0.7rem] font-black text-slate-900">{flagKey(flag)}</p>
                        <p className="truncate text-[0.66rem] font-semibold text-slate-500">{flag.description ?? flag.name ?? 'Description non renseignée'}</p>
                      </div>
                      <button type="button" disabled={archived} onClick={() => onToggleFlag(flag, !active)} className="shrink-0 rounded-lg border border-emerald-900/15 bg-emerald-50 px-2.5 py-1 text-[0.65rem] font-black text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400">
                        {archived ? 'Archivé' : active ? 'Désactiver' : 'Activer'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </AdminPanel>

          <AdminPanel title="Configuration plateforme" subtitle="Lecture typée des clés globales, sans exposer de valeur sensible.">
            {data.configRows.length === 0 ? (
              <AdminEmptyState title="Aucun réglage global" text="La plateforme utilise ses valeurs de configuration par défaut." />
            ) : (
              <div className="grid gap-1.5">
                {data.configRows.slice(0, 14).map((row) => (
                  <div key={row.key} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-[0.78rem] font-black text-slate-900">{configLabel(row.key)}</p>
                      <AdminStatusBadge tone="slate">{configValueType(row.value)}</AdminStatusBadge>
                    </div>
                    <p className="mt-0.5 truncate text-[0.66rem] font-semibold text-slate-500">{row.description ?? configDescription(row.key)}</p>
                    <p className="mt-1 rounded-lg bg-slate-50 px-2 py-1 text-[0.66rem] font-bold text-slate-700">
                      {row.key === 'trial_days' ? `${configPreview(row.value)} jours` : configPreview(row.value)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </AdminPanel>

          <AdminPanel title="Événements système" subtitle="Signaux récents lisibles par l’équipe d’exploitation.">
            {data.systemEvents.length === 0 ? (
              <AdminEmptyState title="Aucun événement système" text="Les signaux de plateforme apparaîtront ici." />
            ) : (
              <div className="grid gap-1.5">
                {data.systemEvents.slice(0, 12).map((event) => (
                  <div key={event.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[0.78rem] font-black text-slate-950">{event.event_type}</p>
                    <p className="line-clamp-1 text-[0.66rem] font-semibold text-slate-500">{event.message} · {formatAdminDateTime(event.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </AdminPanel>

          <AdminPanel title="Journal d’audit" subtitle="Actions sensibles humanisées et traçables.">
            {data.auditLogs.length === 0 ? (
              <AdminEmptyState title="Journal vide" text="Les actions sensibles de la console apparaîtront ici." />
            ) : (
              <div className="grid gap-1.5">
                {data.auditLogs.slice(0, 20).map((log) => (
                  <div key={log.id} className="grid gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-[0.78rem] font-black text-slate-950">{humanizeAuditAction(log.action)}</p>
                      <p className="truncate text-[0.66rem] font-semibold text-slate-500">{log.target_label ?? log.target_type ?? 'Plateforme'}{log.reason ? ` · ${log.reason}` : ''}</p>
                    </div>
                    <span className="text-[0.65rem] font-bold text-slate-500">{formatAdminDateTime(log.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </AdminPanel>
        </div>
      )}
    </div>
  );
}
