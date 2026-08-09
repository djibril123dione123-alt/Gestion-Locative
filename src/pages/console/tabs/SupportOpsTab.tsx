import { useState } from 'react';
import { ClipboardList, LifeBuoy, Mail, Plus, ShieldAlert, TimerReset } from 'lucide-react';
import { formatAdminDate } from '../../../lib/admin/adminFormatters';
import {
  AdminButton,
  AdminEmptyState,
  AdminKpiGrid,
  AdminMetricCard,
  AdminPanel,
  AdminSectionTabs,
  AdminStatusBadge,
  ResponsiveTable,
} from '../../../components/console/AdminPrimitives';
import { SmartCombobox } from '../../../components/ui/SmartCombobox';
import type { AdminConsoleData, AdminIncident, AgencyCreationRequest, AdminTicket } from '../../../services/admin/adminConsoleService';

type SupportView = 'requests' | 'tickets' | 'incidents';

const fieldClass = 'h-9 w-full rounded-[0.7rem] border border-slate-200 bg-[#fffdf8] px-3 text-[0.78rem] font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10';
const textareaClass = `${fieldClass} h-auto min-h-[5rem] resize-none py-2`;
const ticketCategoryOptions = [
  { value: 'support_general', label: 'Support général', subtitle: 'Question ou accompagnement' },
  { value: 'billing', label: 'Paiement', subtitle: 'Plan, preuve ou renouvellement' },
  { value: 'access', label: 'Accès', subtitle: 'Compte, rôle ou permission' },
  { value: 'documents', label: 'Documents', subtitle: 'PDF, GED ou archivage' },
  { value: 'qr', label: 'QR Verify', subtitle: 'Vérification documentaire' },
  { value: 'bug', label: 'Anomalie', subtitle: 'Comportement inattendu' },
];
const ticketPriorityOptions = [
  { value: 'low', label: 'Basse', subtitle: 'Traitement planifié' },
  { value: 'normal', label: 'Normale', subtitle: 'Suivi standard' },
  { value: 'high', label: 'Haute', subtitle: 'Impact opérationnel' },
  { value: 'urgent', label: 'Urgente', subtitle: 'Blocage client' },
];
const incidentSeverityOptions = [
  { value: 'info', label: 'Information', subtitle: 'Signal sans interruption' },
  { value: 'warning', label: 'À surveiller', subtitle: 'Dégradation possible' },
  { value: 'critical', label: 'Critique', subtitle: 'Impact client confirmé' },
  { value: 'blocking', label: 'Bloquant', subtitle: 'Service indisponible' },
];

export function SupportOpsTab({
  data,
  onOpenRequest,
  selectedRequestId,
  onUpdateTicket,
  onCreateTicket,
  onRecordIncident,
  onResolveIncident,
}: {
  data: AdminConsoleData;
  onOpenRequest: (request: AgencyCreationRequest) => void;
  selectedRequestId?: string | null;
  onUpdateTicket: (ticket: AdminTicket, status: string, note: string) => void;
  onCreateTicket: (payload: { organizationId: string; subject: string; category: string; priority: string; description: string }) => void;
  onRecordIncident: (payload: { type: string; severity: string; message: string; organizationId: string | null }) => void;
  onResolveIncident: (incident: AdminIncident, resolution: string) => void;
}) {
  const pendingRequests = data.requests.filter((request) => request.status === 'pending');
  const openTickets = data.tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status ?? ''));
  const openIncidents = data.incidents.filter((incident) => !['resolved', 'ignored'].includes(incident.status ?? ''));

  const [view, setView] = useState<SupportView>('requests');
  const [ticketOrganizationId, setTicketOrganizationId] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('support_general');
  const [ticketPriority, setTicketPriority] = useState('normal');
  const [ticketDescription, setTicketDescription] = useState('');
  const [incidentType, setIncidentType] = useState('manual_admin_incident');
  const [incidentSeverity, setIncidentSeverity] = useState('warning');
  const [incidentOrganizationId, setIncidentOrganizationId] = useState('');
  const [incidentMessage, setIncidentMessage] = useState('');
  const organizationOptions = data.agencies.slice(0, 160).map((agency) => ({
    value: agency.id,
    label: agency.name,
    subtitle: agency.email ?? agency.organization_type ?? 'Organisation',
  }));

  const submitTicket = () => {
    if (!ticketOrganizationId || ticketSubject.trim().length < 3) return;
    onCreateTicket({
      organizationId: ticketOrganizationId,
      subject: ticketSubject.trim(),
      category: ticketCategory,
      priority: ticketPriority,
      description: ticketDescription.trim() || 'Ticket créé depuis la console super-admin.',
    });
    setTicketSubject('');
    setTicketDescription('');
  };

  const submitIncident = () => {
    if (incidentMessage.trim().length < 6) return;
    onRecordIncident({
      type: incidentType,
      severity: incidentSeverity,
      message: incidentMessage.trim(),
      organizationId: incidentOrganizationId || null,
    });
    setIncidentMessage('');
  };

  return (
    <div className="space-y-3">
      <AdminKpiGrid maxItems={5}>
        <AdminMetricCard label="Demandes" value={pendingRequests.length} helper="À examiner" icon={ClipboardList} tone={pendingRequests.length ? 'amber' : 'emerald'} onClick={() => setView('requests')} />
        <AdminMetricCard label="Tickets" value={openTickets.length} helper="Ouverts" icon={LifeBuoy} tone={openTickets.length ? 'amber' : 'slate'} onClick={() => setView('tickets')} />
        <AdminMetricCard label="Incidents" value={openIncidents.length} helper="Ouverts" icon={ShieldAlert} tone={openIncidents.length ? 'red' : 'emerald'} onClick={() => setView('incidents')} />
        <AdminMetricCard label="Historique" value={data.requests.length} helper="Demandes reçues" icon={TimerReset} onClick={() => setView('requests')} />
        <AdminMetricCard label="Annonces" value={data.announcements.length} helper="Plateforme" icon={Mail} onClick={() => { window.location.hash = '/console/system-config'; }} />
      </AdminKpiGrid>

      <AdminSectionTabs
        value={view}
        onChange={(next) => setView(next as SupportView)}
        items={[
          { value: 'requests', label: 'Intégration', count: pendingRequests.length },
          { value: 'tickets', label: 'Tickets', count: openTickets.length },
          { value: 'incidents', label: 'Incidents', count: openIncidents.length },
        ]}
        ariaLabel="Espaces de travail support"
      />

      {view === 'requests' && (
        <AdminPanel title="Demandes d’intégration" subtitle="Examinez chaque demande avant approbation ou rejet.">
          <ResponsiveTable<AgencyCreationRequest>
            rows={data.requests}
            getKey={(request) => request.id}
            selectedKey={selectedRequestId}
            onRowClick={onOpenRequest}
            rowAriaLabel={(request) => `Examiner la demande ${request.organization_name ?? request.agency_name ?? request.id}`}
            empty={<AdminEmptyState title="Aucune demande à traiter" text="Les demandes créées depuis l’onboarding apparaîtront ici." />}
            columns={[
              {
                key: 'name',
                label: 'Organisation',
                render: (request) => (
                  <div className="min-w-0">
                    <p className="truncate text-[0.76rem] font-semibold text-slate-950">{request.organization_name ?? request.agency_name ?? 'Organisation'}</p>
                    {selectedRequestId && <p className="truncate text-[0.67rem] font-semibold text-slate-500">{request.requester_email ?? request.email ?? 'Email non renseigné'}</p>}
                  </div>
                ),
              },
              { key: 'email', label: 'Demandeur', hideWhenDetail: true, render: (request) => request.requester_email ?? request.email ?? 'Non renseigné' },
              { key: 'type', label: 'Type', hideWhenDetail: true, render: (request) => request.is_bailleur_account ? 'Bailleur individuel' : request.organization_type ?? 'Agence' },
              { key: 'plan', label: 'Plan', hideWhenDetail: true, render: (request) => request.requested_plan ?? request.plan ?? 'À confirmer' },
              { key: 'status', label: 'Statut', render: (request) => <AdminStatusBadge status={request.status} /> },
              { key: 'date', label: 'Date', hideWhenDetail: true, render: (request) => formatAdminDate(request.created_at) },
            ]}
            renderCard={(request) => (
              <button type="button" onClick={() => onOpenRequest(request)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50/35">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[0.76rem] font-semibold text-slate-950">{request.organization_name ?? request.agency_name ?? 'Organisation'}</p>
                    <p className="truncate text-xs font-semibold text-slate-500">{request.requester_email ?? request.email ?? 'Email non renseigné'}</p>
                  </div>
                  <AdminStatusBadge status={request.status} />
                </div>
              </button>
            )}
          />
        </AdminPanel>
      )}

      {view === 'tickets' && (
        <div className="grid items-start gap-3 xl:grid-cols-[1.25fr_0.75fr]">
          <AdminPanel title="Tickets support" subtitle="Priorités, suivi client et résolution tracée.">
            {data.tickets.length === 0 ? (
              <AdminEmptyState title="Aucun ticket support" text="Créez un ticket pour centraliser le suivi d’une organisation." />
            ) : (
              <div className="grid gap-1.5">
                {data.tickets.slice(0, 20).map((ticket) => (
                  <div key={ticket.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[0.76rem] font-semibold text-slate-950">{ticket.subject}</p>
                        <AdminStatusBadge status={ticket.status} />
                      </div>
                      <p className="truncate text-[0.68rem] font-semibold text-slate-500">{ticket.category ?? 'Support'} · {formatAdminDate(ticket.created_at)}</p>
                      {ticket.internal_notes && <p className="mt-1 line-clamp-1 text-[0.68rem] font-medium text-slate-500">{ticket.internal_notes}</p>}
                    </div>
                    {!['resolved', 'closed'].includes(ticket.status ?? '') && (
                      <div className="flex shrink-0 gap-1.5">
                        <AdminButton variant="secondary" onClick={() => onUpdateTicket(ticket, 'in_progress', 'Pris en charge depuis la console.')}>Prendre</AdminButton>
                        <AdminButton variant="primary" onClick={() => onUpdateTicket(ticket, 'resolved', 'Résolu depuis la console.')}>Résoudre</AdminButton>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </AdminPanel>

          <AdminPanel title="Nouveau ticket" subtitle="Rattachez le suivi à une organisation.">
            <div className="grid gap-2">
              <label className="grid gap-1 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Organisation
                <SmartCombobox
                  value={ticketOrganizationId}
                  onChange={setTicketOrganizationId}
                  options={organizationOptions}
                  placeholder="Sélectionner une organisation"
                  searchPlaceholder="Rechercher une organisation..."
                  emptyLabel="Aucune organisation trouvée"
                  density="compact"
                  fullWidth
                />
              </label>
              <label className="grid gap-1 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Sujet
                <input value={ticketSubject} onChange={(event) => setTicketSubject(event.target.value)} className={fieldClass} placeholder="Sujet court du ticket" />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <SmartCombobox value={ticketCategory} onChange={setTicketCategory} options={ticketCategoryOptions} density="compact" fullWidth />
                <SmartCombobox value={ticketPriority} onChange={setTicketPriority} options={ticketPriorityOptions} density="compact" fullWidth />
              </div>
              <textarea value={ticketDescription} onChange={(event) => setTicketDescription(event.target.value)} rows={3} className={textareaClass} placeholder="Contexte interne et action attendue" />
              <div className="flex justify-end">
                <AdminButton variant="primary" disabled={!ticketOrganizationId || ticketSubject.trim().length < 3} onClick={submitTicket}>
                  <Plus className="h-3.5 w-3.5" />
                  Créer le ticket
                </AdminButton>
              </div>
            </div>
          </AdminPanel>
        </div>
      )}

      {view === 'incidents' && (
        <div className="grid items-start gap-3 xl:grid-cols-[1.25fr_0.75fr]">
          <AdminPanel title="Incidents système" subtitle="Suivi opérationnel et résolution des incidents enregistrés.">
            {data.incidents.length === 0 ? (
              <AdminEmptyState title="Aucun incident enregistré" text="Les incidents documents, QR, paiements, Auth ou système apparaîtront ici." />
            ) : (
              <div className="grid gap-1.5">
                {data.incidents.slice(0, 20).map((incident) => (
                  <div key={incident.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-[0.76rem] font-semibold text-slate-950">{incident.type}</p>
                      <p className="line-clamp-1 text-[0.68rem] font-semibold text-slate-500">{incident.message ?? 'Incident système'} · {formatAdminDate(incident.last_seen_at ?? incident.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <AdminStatusBadge tone={incident.severity === 'critical' || incident.severity === 'blocking' ? 'red' : 'amber'}>{incident.severity ?? 'warning'}</AdminStatusBadge>
                      <AdminStatusBadge status={incident.status} />
                      {!['resolved', 'ignored'].includes(incident.status ?? '') && (
                        <AdminButton variant="primary" onClick={() => onResolveIncident(incident, 'Résolu depuis la console admin.')}>Résoudre</AdminButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminPanel>

          <AdminPanel title="Déclarer un incident" subtitle="Créez un signal interne relié au journal d’audit.">
            <div className="grid gap-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={incidentType} onChange={(event) => setIncidentType(event.target.value)} className={fieldClass} placeholder="Type d’incident" />
                <SmartCombobox value={incidentSeverity} onChange={setIncidentSeverity} options={incidentSeverityOptions} density="compact" fullWidth />
              </div>
              <SmartCombobox
                value={incidentOrganizationId}
                onChange={setIncidentOrganizationId}
                options={[{ value: '', label: 'Plateforme entière', subtitle: 'Incident global' }, ...organizationOptions]}
                density="compact"
                fullWidth
              />
              <textarea value={incidentMessage} onChange={(event) => setIncidentMessage(event.target.value)} rows={4} className={textareaClass} placeholder="Message lisible pour l’équipe interne" />
              <div className="flex justify-end">
                <AdminButton variant="primary" disabled={incidentMessage.trim().length < 6} onClick={submitIncident}>
                  <Plus className="h-3.5 w-3.5" />
                  Enregistrer l’incident
                </AdminButton>
              </div>
            </div>
          </AdminPanel>
        </div>
      )}
    </div>
  );
}
