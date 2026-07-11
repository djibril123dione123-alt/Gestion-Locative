import { useMemo, useState } from 'react';
import { Building2, CreditCard, FileText, Search, Ticket, UserRound } from 'lucide-react';
import { formatAdminCurrency, formatAdminDate, textValue } from '../../lib/admin/adminFormatters';
import { documentTypeLabel, organizationTypeLabel } from '../../lib/admin/adminInsights';
import type {
  AdminAgency,
  AdminConsoleData,
  AdminUser,
  AgencyCreationRequest,
  SubscriptionPaymentProof,
} from '../../services/admin/adminConsoleService';
import type { ConsoleSpace } from '../../lib/admin/adminNavigation';

type SearchResult = {
  id: string;
  label: string;
  description: string;
  type: 'agency' | 'user' | 'proof' | 'request' | 'ticket' | 'document';
  action: () => void;
};

const iconByType = {
  agency: Building2,
  user: UserRound,
  proof: CreditCard,
  request: Ticket,
  ticket: Ticket,
  document: FileText,
} satisfies Record<SearchResult['type'], typeof Building2>;

const labelByType: Record<SearchResult['type'], string> = {
  agency: 'Organisation',
  user: 'Utilisateur',
  proof: 'Paiement',
  request: 'Demande',
  ticket: 'Ticket',
  document: 'Document',
};

function includes(value: unknown, query: string) {
  return String(value ?? '').toLowerCase().includes(query);
}

export function AdminGlobalSearch({
  data,
  onOpenAgency,
  onOpenProof,
  onOpenRequest,
  onOpenUser,
  onOpenAgencyById,
  onChangeSpace,
}: {
  data: AdminConsoleData;
  onOpenAgency: (agency: AdminAgency) => void;
  onOpenProof: (proof: SubscriptionPaymentProof) => void;
  onOpenRequest: (request: AgencyCreationRequest) => void;
  onOpenUser: (user: AdminUser) => void;
  onOpenAgencyById: (agencyId: string | null | undefined) => void;
  onChangeSpace: (space: ConsoleSpace) => void;
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const results = useMemo<SearchResult[]>(() => {
    if (normalizedQuery.length < 2) return [];
    const next: SearchResult[] = [];

    for (const agency of data.agencies) {
      if (![agency.name, agency.email, agency.phone, agency.id, agency.plan, agency.status].some((value) => includes(value, normalizedQuery))) continue;
      next.push({
        id: `agency-${agency.id}`,
        type: 'agency',
        label: agency.name,
        description: `${organizationTypeLabel(agency)} · ${textValue(agency.email)} · ${agency.plan ?? 'plan non défini'}`,
        action: () => onOpenAgency(agency),
      });
    }

    for (const user of data.users) {
      const fullName = `${user.prenom ?? ''} ${user.nom ?? ''}`.trim();
      if (![fullName, user.email, user.role, user.agency_name, user.id].some((value) => includes(value, normalizedQuery))) continue;
      next.push({
        id: `user-${user.id}`,
        type: 'user',
        label: fullName || user.email || 'Utilisateur',
        description: `${user.role ?? 'rôle non défini'} · ${user.agency_name ?? 'sans organisation'}`,
        action: () => onOpenUser(user),
      });
    }

    for (const proof of data.proofs) {
      if (![proof.reference, proof.method, proof.plan_key, proof.status, proof.id, proof.agencies?.name].some((value) => includes(value, normalizedQuery))) continue;
      next.push({
        id: `proof-${proof.id}`,
        type: 'proof',
        label: proof.reference ?? `Paiement ${proof.plan_key}`,
        description: `${proof.agencies?.name ?? 'Organisation'} · ${formatAdminCurrency(proof.amount)} · ${proof.status}`,
        action: () => onOpenProof(proof),
      });
    }

    for (const request of data.requests) {
      if (![request.organization_name, request.agency_name, request.email, request.requester_email, request.status, request.id].some((value) => includes(value, normalizedQuery))) continue;
      next.push({
        id: `request-${request.id}`,
        type: 'request',
        label: request.organization_name ?? request.agency_name ?? 'Demande organisation',
        description: `${request.requester_email ?? request.email ?? 'email non renseigné'} · ${request.status}`,
        action: () => onOpenRequest(request),
      });
    }

    for (const ticket of data.tickets) {
      if (![ticket.subject, ticket.category, ticket.priority, ticket.status, ticket.id].some((value) => includes(value, normalizedQuery))) continue;
      next.push({
        id: `ticket-${ticket.id}`,
        type: 'ticket',
        label: ticket.subject,
        description: `${ticket.category ?? 'support'} · ${ticket.priority ?? 'normal'} · ${formatAdminDate(ticket.created_at)}`,
        action: () => {
          onChangeSpace('support-ops');
          onOpenAgencyById(ticket.organization_id);
        },
      });
    }

    for (const document of data.documentRegistry) {
      if (![document.reference, document.document_type, document.status, document.agencies?.name, document.id].some((value) => includes(value, normalizedQuery))) continue;
      next.push({
        id: `document-${document.id}`,
        type: 'document',
        label: `${documentTypeLabel(document.document_type)} · ${document.reference ?? 'sans référence'}`,
        description: `${document.agencies?.name ?? 'Organisation'} · ${document.status ?? 'statut non défini'} · ${formatAdminDate(document.created_at)}`,
        action: () => {
          onChangeSpace('system-config');
          onOpenAgencyById(document.agency_id);
        },
      });
    }

    return next.slice(0, 12);
  }, [data, normalizedQuery, onChangeSpace, onOpenAgency, onOpenAgencyById, onOpenProof, onOpenRequest, onOpenUser]);

  return (
    <div className="relative w-full max-w-2xl">
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-950/10 bg-white px-3 py-2 shadow-[0_12px_34px_rgba(15,23,42,0.045)]">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher agence, paiement, utilisateur, ticket, document..."
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
        />
      </div>

      {normalizedQuery.length >= 2 && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
          {results.length === 0 ? (
            <div className="px-4 py-4 text-sm font-semibold text-slate-500">Aucun résultat exploitable.</div>
          ) : (
            <div className="max-h-[380px] overflow-y-auto p-2">
              {results.map((result) => {
                const Icon = iconByType[result.type];
                return (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => {
                      result.action();
                      setQuery('');
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
                  >
                    <span className="rounded-xl border border-emerald-950/10 bg-emerald-50 p-2 text-emerald-800">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-slate-950">{result.label}</span>
                      <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{result.description}</span>
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.1em] text-slate-500">
                      {labelByType[result.type]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
