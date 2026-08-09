import { useMemo, useState } from 'react';
import { CalendarDays, CreditCard, FileText, Mail, MessageCircle, ShieldAlert, Users } from 'lucide-react';
import { PremiumDrawerShell } from '../ui/PremiumDrawerShell';
import { SmartCombobox } from '../ui/SmartCombobox';
import { getStatusLabel } from '../../lib/admin/adminStatusMapping';
import { getAdminPlan } from '../../lib/admin/adminPricingCatalog';
import { documentTypeLabel, organizationTypeLabel } from '../../lib/admin/adminInsights';
import { formatAdminCurrency, formatAdminDate, textValue } from '../../lib/admin/adminFormatters';
import { computeOrganizationHealth } from '../../lib/admin/adminRiskScoring';
import { humanizeAuditAction } from '../../services/admin/adminAuditService';
import { AdminButton, AdminKpiGrid, AdminMetricCard, AdminPanel, AdminStatusBadge } from './AdminPrimitives';
import type {
  AdminAgency,
  AdminAuditLog,
  AdminDocumentRegistryEntry,
  AdminDocumentVerification,
  AdminIncident,
  AdminNote,
  AdminOrganizationMetric,
  AdminSubscription,
  AdminTicket,
  AdminUser,
  SubscriptionPaymentProof,
} from '../../services/admin/adminConsoleService';

export function OrganizationDrawer({
  agency,
  users,
  subscriptions,
  proofs,
  notes,
  tickets,
  incidents,
  documents,
  verifications,
  metrics,
  auditLogs,
  onClose,
  onChangeStatus,
  onChangePlan,
  onExtendTrial,
  onDelete,
  onCreateNote,
  onCreateTicket,
}: {
  agency: AdminAgency | null;
  users: AdminUser[];
  subscriptions: AdminSubscription[];
  proofs: SubscriptionPaymentProof[];
  notes: AdminNote[];
  tickets: AdminTicket[];
  incidents: AdminIncident[];
  documents: AdminDocumentRegistryEntry[];
  verifications: AdminDocumentVerification[];
  metrics?: AdminOrganizationMetric;
  auditLogs: AdminAuditLog[];
  onClose: () => void;
  onChangeStatus: (agency: AdminAgency, nextStatus: 'active' | 'suspended') => void;
  onChangePlan: (agency: AdminAgency, subscription: AdminSubscription | undefined, plan: string) => void;
  onExtendTrial: (agency: AdminAgency, days: number) => void;
  onDelete: (agency: AdminAgency) => void;
  onCreateNote: (agency: AdminAgency, note: string, visibility: 'internal' | 'support' | 'commercial' | 'security') => void;
  onCreateTicket: (agency: AdminAgency, subject: string, category: string, priority: string, description: string) => void;
}) {
  const [note, setNote] = useState('');
  const [noteVisibility, setNoteVisibility] = useState<'internal' | 'support' | 'commercial' | 'security'>('internal');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('support_general');
  const [ticketPriority, setTicketPriority] = useState('normal');

  const latestAudit = useMemo(() => auditLogs.slice(0, 8), [auditLogs]);
  if (!agency) return null;

  const activeSub = subscriptions[0];
  const plan = getAdminPlan(activeSub?.plan_id ?? agency.plan);
  const health = computeOrganizationHealth(agency, activeSub, proofs);
  const typeLabel = organizationTypeLabel(agency);
  const openTickets = tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status ?? ''));
  const openIncidents = incidents.filter((incident) => !['resolved', 'ignored'].includes(incident.status ?? ''));
  const contactEmail = agency.email ? `mailto:${agency.email}?subject=Samay%20Keur%20-%20Suivi%20compte` : undefined;
  const whatsappPhone = agency.phone?.replace(/\D/g, '');
  const whatsappUrl = whatsappPhone ? `https://wa.me/${whatsappPhone}` : undefined;

  return (
    <PremiumDrawerShell
      open={!!agency}
      onClose={onClose}
      size="compact"
      density="compact"
      desktopMode="floating"
      desktopAt="lg"
      className="h-full lg:!w-full"
      eyebrow={(
        <div className="flex flex-wrap items-center gap-1.5">
          <AdminStatusBadge status={agency.status} />
          <AdminStatusBadge tone={health.level === 'healthy' ? 'emerald' : health.level === 'watch' ? 'amber' : 'red'}>{health.label}</AdminStatusBadge>
          <AdminStatusBadge tone="slate">{typeLabel}</AdminStatusBadge>
          {openTickets.length > 0 && <AdminStatusBadge tone="amber">{openTickets.length} ticket(s)</AdminStatusBadge>}
          {openIncidents.length > 0 && <AdminStatusBadge tone="red">{openIncidents.length} incident(s)</AdminStatusBadge>}
        </div>
      )}
      title={agency.name}
      description={`Créée ${formatAdminDate(agency.created_at)} · Dernière activité ${formatAdminDate(agency.derniere_activite)}`}
    >

      <AdminKpiGrid maxItems={4}>
          <AdminMetricCard label="Score santé" value={`${metrics?.health_score ?? health.score}/100`} icon={ShieldAlert} tone={health.level === 'healthy' ? 'emerald' : 'amber'} />
          <AdminMetricCard label="Plan" value={plan.name} helper={plan.priceLabel} icon={CreditCard} tone="orange" />
          <AdminMetricCard label="Utilisateurs" value={agency.nb_users ?? users.length} icon={Users} />
          <AdminMetricCard label="Documents" value={metrics?.total_documents ?? agency.total_documents ?? documents.length} icon={FileText} />
        </AdminKpiGrid>

        <div className="mt-3 grid items-start gap-3">
          <AdminPanel title="Résumé opérationnel" subtitle="Identité, contact, plan et signaux de santé.">
            <div className="grid gap-1.5 text-[0.72rem]">
              {[
                ['Type', typeLabel],
                ['Email', textValue(agency.email)],
                ['Téléphone', textValue(agency.phone)],
                ['Statut', getStatusLabel(agency.status ?? 'active')],
                ['Plan actif', plan.name],
                ['Renouvellement / essai', formatAdminDate(activeSub?.current_period_end ?? agency.trial_ends_at)],
                ['Unités / contrats', `${agency.nb_unites ?? metrics?.total_units ?? 0} unités · ${agency.nb_contrats ?? metrics?.total_contracts ?? 0} contrats`],
                ['Volume paiements', formatAdminCurrency(agency.volume_paiements ?? metrics?.payments_amount)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0">
                  <span className="text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span>
                  <span className="text-right font-semibold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel title="Centre de contact" subtitle="Actions rapides support sans exposer de données sensibles.">
            <div className="grid gap-2">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-slate-500">Contact principal</p>
                <p className="mt-1 truncate text-[0.76rem] font-semibold text-slate-950">{agency.email ?? agency.phone ?? 'Non renseigné'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <AdminButton disabled={!contactEmail} onClick={() => contactEmail && window.open(contactEmail, '_blank')}>
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </AdminButton>
                <AdminButton disabled={!whatsappUrl} onClick={() => whatsappUrl && window.open(whatsappUrl, '_blank')}>
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </AdminButton>
              </div>
              <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <input value={ticketSubject} onChange={(event) => setTicketSubject(event.target.value)} className="h-8 rounded-[0.6rem] border border-slate-200 px-2.5 text-[0.72rem] font-medium outline-none" placeholder="Créer ticket : sujet..." />
                <div className="grid gap-2 sm:grid-cols-2">
                  <SmartCombobox
                    value={ticketCategory}
                    onChange={setTicketCategory}
                    density="compact"
                    fullWidth
                    options={[
                      { value: 'support_general', label: 'Support général' },
                      { value: 'billing', label: 'Paiement' },
                      { value: 'access', label: 'Accès' },
                      { value: 'documents', label: 'Documents' },
                      { value: 'qr', label: 'QR Verify' },
                      { value: 'bug', label: 'Anomalie' },
                    ]}
                  />
                  <SmartCombobox
                    value={ticketPriority}
                    onChange={setTicketPriority}
                    density="compact"
                    fullWidth
                    options={[
                      { value: 'low', label: 'Basse' },
                      { value: 'normal', label: 'Normale' },
                      { value: 'high', label: 'Haute' },
                      { value: 'urgent', label: 'Urgente' },
                    ]}
                  />
                </div>
                <AdminButton disabled={ticketSubject.trim().length < 3} onClick={() => {
                  onCreateTicket(agency, ticketSubject.trim(), ticketCategory, ticketPriority, 'Créé depuis la fiche organisation.');
                  setTicketSubject('');
                }}>
                  Créer ticket
                </AdminButton>
              </div>
            </div>
          </AdminPanel>
        </div>

        <div className="mt-3 grid items-start gap-3">
          <AdminPanel title="Risques détectés" subtitle="Signaux à traiter avant friction client.">
            <div className="space-y-2">
              {health.reasons.map((reason) => (
                <div key={reason} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
                  {reason}
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel title="Abonnement & paiements" subtitle="Plan, preuves manuelles et volumes." action={<AdminStatusBadge status={activeSub?.status ?? agency.status} />}>
            <div className="space-y-2">
              {proofs.length === 0 ? (
                <p className="text-xs font-semibold text-slate-500">Aucune preuve manuelle liée à cette organisation.</p>
              ) : proofs.slice(0, 5).map((proof) => (
                <div key={proof.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                  <div>
                    <p className="text-[0.76rem] font-semibold text-slate-900">{formatAdminCurrency(proof.amount)} · {proof.method}</p>
                    <p className="text-[0.66rem] font-medium text-slate-500">{proof.reference ?? 'Référence non renseignée'}</p>
                  </div>
                  <AdminStatusBadge status={proof.status} />
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel title="Utilisateurs rattachés" subtitle="Admins, agents et comptes actifs.">
            <div className="space-y-2">
              {users.length === 0 ? (
                <p className="text-xs font-semibold text-slate-500">Aucun utilisateur rattaché détecté.</p>
              ) : users.slice(0, 6).map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[0.76rem] font-semibold text-slate-900">{`${user.prenom ?? ''} ${user.nom ?? ''}`.trim() || user.email}</p>
                    <p className="truncate text-[0.66rem] font-medium text-slate-500">{user.email}</p>
                  </div>
                  <AdminStatusBadge status={user.actif === false ? 'suspended' : 'active'}>{user.role}</AdminStatusBadge>
                </div>
              ))}
            </div>
          </AdminPanel>
        </div>

        <div className="mt-3 grid items-start gap-3">
          <AdminPanel
            title="Documents & QR"
            subtitle="Métadonnées uniquement par défaut : aucun PDF privé n’est ouvert ici."
            action={<AdminStatusBadge tone="blue">{verifications.length} QR suivis</AdminStatusBadge>}
          >
            <div className="space-y-2">
              {documents.length === 0 ? (
                <p className="text-xs font-semibold text-slate-500">Aucun document enregistré pour cette organisation.</p>
              ) : documents.slice(0, 6).map((document) => (
                <div key={document.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <div>
                    <p className="text-[0.76rem] font-semibold text-slate-900">{documentTypeLabel(document.document_type)}</p>
                    <p className="text-[0.66rem] font-medium text-slate-500">{document.reference ?? document.period ?? 'Référence interne'} · {formatAdminDate(document.generated_at ?? document.created_at)}</p>
                  </div>
                  <AdminStatusBadge status={document.status} />
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel title="Notes internes" subtitle="Support, commercial, sécurité ou suivi administratif.">
            <div className="space-y-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="w-full resize-none rounded-[0.6rem] border border-slate-200 px-2.5 py-2 text-[0.72rem] font-medium outline-none" placeholder="Ajouter une note interne..." />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-[10rem]">
                    <SmartCombobox
                      value={noteVisibility}
                      onChange={(value) => setNoteVisibility(value as typeof noteVisibility)}
                      density="compact"
                      fullWidth
                      options={[
                        { value: 'internal', label: 'Interne' },
                        { value: 'support', label: 'Support' },
                        { value: 'commercial', label: 'Commercial' },
                        { value: 'security', label: 'Sécurité' },
                      ]}
                    />
                  </div>
                  <AdminButton disabled={note.trim().length < 3} onClick={() => {
                    onCreateNote(agency, note.trim(), noteVisibility);
                    setNote('');
                  }}>
                    Ajouter note
                  </AdminButton>
                </div>
              </div>
              {notes.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <AdminStatusBadge tone="slate">{item.visibility === 'internal' ? 'Interne' : item.visibility === 'support' ? 'Support' : item.visibility ?? 'Interne'}</AdminStatusBadge>
                    <span className="text-xs font-semibold text-slate-400">{formatAdminDate(item.created_at)}</span>
                  </div>
                  <p className="mt-2 text-[0.72rem] font-medium leading-4 text-slate-700">{item.note}</p>
                </div>
              ))}
            </div>
          </AdminPanel>
        </div>

        <AdminPanel title="Timeline & audit" subtitle="Dernières actions sensibles liées à cette organisation." className="mt-3">
          <div className="grid gap-2">
            {latestAudit.length === 0 ? (
              <p className="text-xs font-semibold text-slate-500">Aucune action auditée liée à cette organisation.</p>
            ) : latestAudit.map((log) => (
              <div key={log.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[0.76rem] font-semibold text-slate-950">{humanizeAuditAction(log.action)}</p>
                <p className="text-[0.66rem] font-medium text-slate-500">{log.reason ?? log.target_type ?? 'Action administrateur'} · {formatAdminDate(log.created_at)}</p>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="Actions sensibles" subtitle="Audit strict obligatoire avant mutation." className="mt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {['starter', 'pro', 'business', 'enterprise'].map((planId) => (
              <AdminButton key={planId} disabled={plan.id === planId} onClick={() => onChangePlan(agency, activeSub, planId)}>
                Plan {getAdminPlan(planId).name}
              </AdminButton>
            ))}
            <AdminButton onClick={() => onExtendTrial(agency, 14)}>
              <CalendarDays className="h-3.5 w-3.5" />
              +14 jours
            </AdminButton>
            <AdminButton variant={agency.status === 'suspended' ? 'primary' : 'danger'} onClick={() => onChangeStatus(agency, agency.status === 'suspended' ? 'active' : 'suspended')}>
              {agency.status === 'suspended' ? 'Réactiver' : 'Suspendre'}
            </AdminButton>
            <AdminButton variant="danger" onClick={() => onDelete(agency)}>
              Clôturer le compte
            </AdminButton>
          </div>
        </AdminPanel>
    </PremiumDrawerShell>
  );
}
