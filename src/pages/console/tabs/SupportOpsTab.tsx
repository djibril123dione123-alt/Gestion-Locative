import { useState } from 'react';
import { ClipboardList, LifeBuoy, Mail, Plus, ShieldAlert, TimerReset } from 'lucide-react';
import { formatAdminDate } from '../../../lib/admin/adminFormatters';
import { AdminButton, AdminEmptyState, AdminMetricCard, AdminPanel, AdminStatusBadge, ResponsiveTable } from '../../../components/console/AdminPrimitives';
import type { AdminConsoleData, AdminIncident, AgencyCreationRequest, AdminTicket } from '../../../services/admin/adminConsoleService';

export function SupportOpsTab({
  data,
  onOpenRequest,
  onUpdateTicket,
  onRecordIncident,
  onResolveIncident,
}: {
  data: AdminConsoleData;
  onOpenRequest: (request: AgencyCreationRequest) => void;
  onUpdateTicket: (ticket: AdminTicket, status: string, note: string) => void;
  onRecordIncident: (payload: { type: string; severity: string; message: string; organizationId: string | null }) => void;
  onResolveIncident: (incident: AdminIncident, resolution: string) => void;
}) {
  const pendingRequests = data.requests.filter((request) => request.status === 'pending');
  const openTickets = data.tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status ?? ''));
  const openIncidents = data.incidents.filter((incident) => !['resolved', 'ignored'].includes(incident.status ?? ''));
  const [incidentType, setIncidentType] = useState('manual_admin_incident');
  const [incidentSeverity, setIncidentSeverity] = useState('warning');
  const [incidentOrganizationId, setIncidentOrganizationId] = useState('');
  const [incidentMessage, setIncidentMessage] = useState('');

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
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard label="Demandes en attente" value={pendingRequests.length} icon={ClipboardList} tone={pendingRequests.length ? 'amber' : 'emerald'} />
        <AdminMetricCard label="Tickets ouverts" value={openTickets.length} icon={LifeBuoy} tone={openTickets.length ? 'amber' : 'slate'} />
        <AdminMetricCard label="Incidents ouverts" value={openIncidents.length} icon={ShieldAlert} tone={openIncidents.length ? 'red' : 'emerald'} />
        <AdminMetricCard label="Demandes totales" value={data.requests.length} icon={TimerReset} />
        <AdminMetricCard label="Communication" value={data.announcements.length} helper="Annonces plateforme" icon={Mail} />
      </div>

      <AdminPanel title="Demandes d’intégration" subtitle="Fiche d’examen obligatoire avant approbation ou rejet.">
        <ResponsiveTable
          rows={data.requests}
          getKey={(request) => request.id}
          empty={<AdminEmptyState title="Aucune demande à traiter" text="Les demandes créées depuis l’onboarding apparaîtront ici." />}
          columns={[
            { key: 'name', label: 'Organisation', render: (request) => <span className="font-black text-slate-950">{request.organization_name ?? request.agency_name ?? 'Organisation'}</span> },
            { key: 'email', label: 'Demandeur', render: (request) => request.requester_email ?? request.email ?? 'Non renseigné' },
            { key: 'type', label: 'Type', render: (request) => request.is_bailleur_account ? 'Bailleur individuel' : request.organization_type ?? 'Agence' },
            { key: 'plan', label: 'Plan', render: (request) => request.requested_plan ?? request.plan ?? 'À confirmer' },
            { key: 'status', label: 'Statut', render: (request) => <AdminStatusBadge status={request.status} /> },
            { key: 'date', label: 'Date', render: (request) => formatAdminDate(request.created_at) },
            { key: 'action', label: 'Action', align: 'right', render: (request) => <button type="button" onClick={() => onOpenRequest(request)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-800">Examiner</button> },
          ]}
          renderCard={(request) => (
            <button type="button" onClick={() => onOpenRequest(request)} className="rounded-2xl border border-slate-200 bg-white p-3 text-left">
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

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminPanel title="Tickets support" subtitle="Traitement client avec notes internes et statut audité.">
          {data.tickets.length === 0 ? (
            <AdminEmptyState title="Aucun ticket support ouvert" text="Les tickets clients et incidents de support apparaîtront ici dès qu’ils seront enregistrés." />
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
