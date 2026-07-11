import { ClipboardList, LifeBuoy, Mail, TimerReset } from 'lucide-react';
import { formatAdminDate } from '../../../lib/admin/adminFormatters';
import { AdminEmptyState, AdminMetricCard, AdminPanel, AdminStatusBadge, ResponsiveTable } from '../../../components/console/AdminPrimitives';
import type { AdminConsoleData, AgencyCreationRequest, AdminTicket } from '../../../services/admin/adminConsoleService';

export function SupportOpsTab({
  data,
  onOpenRequest,
}: {
  data: AdminConsoleData;
  onOpenRequest: (request: AgencyCreationRequest) => void;
}) {
  const pendingRequests = data.requests.filter((request) => request.status === 'pending');
  const openTickets = data.tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status ?? ''));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Demandes en attente" value={pendingRequests.length} icon={ClipboardList} tone={pendingRequests.length ? 'amber' : 'emerald'} />
        <AdminMetricCard label="Tickets ouverts" value={openTickets.length} icon={LifeBuoy} tone={openTickets.length ? 'amber' : 'slate'} />
        <AdminMetricCard label="Demandes totales" value={data.requests.length} icon={TimerReset} />
        <AdminMetricCard label="Communication" value="Disponible" helper="Annonces via notifications" icon={Mail} />
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

      <AdminPanel title="Tickets support" subtitle="Support client séparé des demandes d’intégration.">
        {data.tickets.length === 0 ? (
          <AdminEmptyState title="Aucun ticket support ouvert" text="Les tickets clients et incidents de support apparaîtront ici dès qu’ils seront enregistrés." />
        ) : (
          <div className="grid gap-2">
            {data.tickets.slice(0, 12).map((ticket: AdminTicket) => (
              <div key={ticket.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div>
                  <p className="text-sm font-black text-slate-950">{ticket.subject}</p>
                  <p className="text-xs font-semibold text-slate-500">{ticket.category ?? 'Support'} · {formatAdminDate(ticket.created_at)}</p>
                </div>
                <AdminStatusBadge status={ticket.status} />
              </div>
            ))}
          </div>
        )}
      </AdminPanel>
    </div>
  );
}
