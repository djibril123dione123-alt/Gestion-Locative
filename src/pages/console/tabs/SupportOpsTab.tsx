import { useState } from 'react';
import { ClipboardList, LifeBuoy, Mail, Plus, ShieldAlert, TimerReset } from 'lucide-react';
import { formatAdminDate } from '../../../lib/admin/adminFormatters';
import { AdminButton, AdminEmptyState, AdminKpiGrid, AdminMetricCard, AdminPanel, AdminStatusBadge, ResponsiveTable } from '../../../components/console/AdminPrimitives';
import type { AdminConsoleData, AdminIncident, AgencyCreationRequest, AdminTicket } from '../../../services/admin/adminConsoleService';

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

  const [ticketOrganizationId, setTicketOrganizationId] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('support_general');
  const [ticketPriority, setTicketPriority] = useState('normal');
  const [ticketDescription, setTicketDescription] = useState('');
  const [incidentType, setIncidentType] = useState('manual_admin_incident');
  const [incidentSeverity, setIncidentSeverity] = useState('warning');
  const [incidentOrganizationId, setIncidentOrganizationId] = useState('');
  const [incidentMessage, setIncidentMessage] = useState('');

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
    onRecordIncident({
      type: incidentType,
      severity: incidentSeverity,
      message: incidentMessage,
      organizationId: incidentOrganizationId || null,
    });
    setIncidentMessage('');
  };

  return (
    <div className="space-y-3">
      <AdminKpiGrid maxItems={5}>
        <AdminMetricCard label="Demandes" value={pendingRequests.length} helper="À examiner" icon={ClipboardList} tone={pendingRequests.length ? 'amber' : 'emerald'} />
        <AdminMetricCard label="Tickets" value={openTickets.length} helper="Ouverts" icon={LifeBuoy} tone={openTickets.length ? 'amber' : 'slate'} />
        <AdminMetricCard label="Incidents" value={openIncidents.length} helper="Ouverts" icon={ShieldAlert} tone={openIncidents.length ? 'red' : 'emerald'} />
        <AdminMetricCard label="Total" value={data.requests.length} helper="Demandes" icon={TimerReset} />
        <AdminMetricCard label="Annonces" value={data.announcements.length} helper="Plateforme" icon={Mail} />
      </AdminKpiGrid>

      <AdminPanel title="Demandes d’intégration" subtitle="Fiche d’examen obligatoire avant approbation ou rejet.">
        <ResponsiveTable<AgencyCreationRequest>
          rows={data.requests}
          getKey={(request) => request.id}
          selectedKey={selectedRequestId}
          onRowClick={onOpenRequest}
          rowAriaLabel={(request) => `Examiner la demande ${request.organization_name ?? request.agency_name ?? request.id}`}
          empty={<AdminEmptyState title="Aucune demande à traiter" text="Les demandes créées depuis l’onboarding apparaîtront ici." />}
          columns={[
            { key: 'name', label: 'Organisation', render: (request) => <span className="font-black text-slate-950">{request.organization_name ?? request.agency_name ?? 'Organisation'}</span> },
            { key: 'email', label: 'Demandeur', render: (request) => request.requester_email ?? request.email ?? 'Non renseigné' },
            { key: 'type', label: 'Type', render: (request) => request.is_bailleur_account ? 'Bailleur individuel' : request.organization_type ?? 'Agence' },
            { key: 'plan', label: 'Plan', render: (request) => request.requested_plan ?? request.plan ?? 'À confirmer' },
            { key: 'status', label: 'Statut', render: (request) => <AdminStatusBadge status={request.status} /> },
            { key: 'date', label: 'Date', render: (request) => formatAdminDate(request.created_at) },
          ]}
          renderCard={(request) => (
            <button type="button" onClick={() => onOpenRequest(request)} className="rounded-[1.05rem] border border-slate-200 bg-white p-3 text-left">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{request.organization_name ?? request.agency_name ?? 'Organisation'}</p>
                  <p className="text-xs font-semibold text-slate-500">{request.requester_email ?? request.email ?? 'Email non renseigné'}</p>
                </div>
                <AdminStatusBadge status={request.status} />
              </div>
            </button>
          )}
        />
      </AdminPanel>

      <div className="grid items-start gap-3 xl:grid-cols-[1.08fr_0.92fr]">
        <AdminPanel title="Tickets support" subtitle="Traitement client avec notes internes et statut audité.">
          {data.tickets.length === 0 ? (
            <AdminEmptyState title="Aucun ticket support ouvert" text="Créez un ticket depuis cette page ou depuis une fiche organisation." />
          ) : (
            <div className="grid gap-2">
              {data.tickets.slice(0, 12).map((ticket: AdminTicket) => (
                <div key={ticket.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-950">{ticket.subject}</p>
                      <p className="text-xs font-semibold text-slate-500">{ticket.category ?? 'Support'} · {formatAdminDate(ticket.created_at)}</p>
                      {ticket.internal_notes && <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-500">{ticket.internal_notes}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminStatusBadge status={ticket.status} />
                      {!['resolved', 'closed'].includes(ticket.status ?? '') && (
                        <>
                          <button type="button" onClick={() => onUpdateTicket(ticket, 'in_progress', 'Pris en charge depuis la console.')} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black">Prendre</button>
                          <button type="button" onClick={() => onUpdateTicket(ticket, 'resolved', 'Résolu depuis la console.')} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-900">Résoudre</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>

        <div className="space-y-3">
          <AdminPanel title="Créer ticket support" subtitle="Action opérationnelle rattachée à une organisation.">
            <div className="grid gap-2">
              <select value={ticketOrganizationId} onChange={(event) => setTicketOrganizationId(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
                <option value="">Sélectionner une organisation</option>
                {data.agencies.slice(0, 160).map((agency) => (
                  <option key={agency.id} value={agency.id}>{agency.name}</option>
                ))}
              </select>
              <input value={ticketSubject} onChange={(event) => setTicketSubject(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none" placeholder="Sujet court du ticket..." />
              <div className="grid gap-2 sm:grid-cols-2">
                <select value={ticketCategory} onChange={(event) => setTicketCategory(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
                  <option value="support_general">Support général</option>
                  <option value="billing">Paiement</option>
                  <option value="access">Accès</option>
                  <option value="documents">Documents</option>
                  <option value="qr">QR Verify</option>
                  <option value="bug">Bug</option>
                </select>
                <select value={ticketPriority} onChange={(event) => setTicketPriority(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
                  <option value="low">Basse</option>
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
              <textarea value={ticketDescription} onChange={(event) => setTicketDescription(event.target.value)} rows={2} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none" placeholder="Contexte interne, action attendue..." />
              <AdminButton variant="primary" disabled={!ticketOrganizationId || ticketSubject.trim().length < 3} onClick={submitTicket}>
                <Plus className="h-3.5 w-3.5" />
                Créer ticket
              </AdminButton>
            </div>
          </AdminPanel>

          <AdminPanel title="Déclarer un incident" subtitle="Création d’incident interne reliée à l’audit super-admin.">
            <div className="grid gap-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={incidentType} onChange={(event) => setIncidentType(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none" placeholder="Type incident" />
                <select value={incidentSeverity} onChange={(event) => setIncidentSeverity(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
                  <option value="info">Info</option>
                  <option value="warning">À surveiller</option>
                  <option value="critical">Critique</option>
                  <option value="blocking">Bloquant</option>
                </select>
              </div>
              <select value={incidentOrganizationId} onChange={(event) => setIncidentOrganizationId(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
                <option value="">Plateforme entière</option>
                {data.agencies.slice(0, 100).map((agency) => (
                  <option key={agency.id} value={agency.id}>{agency.name}</option>
                ))}
              </select>
              <textarea value={incidentMessage} onChange={(event) => setIncidentMessage(event.target.value)} rows={3} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none" placeholder="Message lisible pour l’équipe interne..." />
              <AdminButton variant="primary" disabled={incidentMessage.trim().length < 6} onClick={submitIncident}>
                <Plus className="h-3.5 w-3.5" />
                Enregistrer incident
              </AdminButton>
            </div>
          </AdminPanel>
        </div>
      </div>

      <AdminPanel title="Incidents système" subtitle="Incidents ouverts, résolution et suivi opérationnel.">
        {data.incidents.length === 0 ? (
          <AdminEmptyState title="Aucun incident enregistré" text="Les incidents document, QR, paiement, Auth ou système seront listés ici." />
        ) : (
          <div className="grid gap-2">
            {data.incidents.slice(0, 12).map((incident) => (
              <div key={incident.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-950">{incident.type}</p>
                  <p className="text-xs font-semibold text-slate-500">{incident.message ?? 'Incident système'} · {formatAdminDate(incident.last_seen_at ?? incident.created_at)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminStatusBadge tone={incident.severity === 'critical' || incident.severity === 'blocking' ? 'red' : 'amber'}>{incident.severity ?? 'warning'}</AdminStatusBadge>
                  <AdminStatusBadge status={incident.status} />
                  {!['resolved', 'ignored'].includes(incident.status ?? '') && (
                    <button type="button" onClick={() => onResolveIncident(incident, 'Résolu depuis la console admin.')} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-900">Résoudre</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminPanel>
    </div>
  );
}
