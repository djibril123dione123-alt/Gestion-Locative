import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { getAdminPlan } from '../../../lib/admin/adminPricingCatalog';
import { formatAdminCurrency, formatAdminDate } from '../../../lib/admin/adminFormatters';
import { AdminEmptyState, AdminPanel, AdminStatusBadge, ResponsiveTable } from '../../../components/console/AdminPrimitives';
import type { AdminAgency, AdminConsoleData } from '../../../services/admin/adminConsoleService';

export function OrganizationsTab({ data, onOpenAgency }: { data: AdminConsoleData; onOpenAgency: (agency: AdminAgency) => void }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const rows = useMemo(() => data.agencies.filter((agency) => {
    const haystack = `${agency.name} ${agency.email ?? ''} ${agency.phone ?? ''}`.toLowerCase();
    const matchQuery = !query || haystack.includes(query.toLowerCase());
    const matchStatus = status === 'all' || (agency.status ?? 'active') === status;
    const agencyType = agency.is_bailleur_account || agency.organization_type === 'individual_landlord' ? 'individual' : 'agency';
    const matchType = type === 'all' || agencyType === type;
    return matchQuery && matchStatus && matchType;
  }), [data.agencies, query, status, type]);

  return (
    <div className="space-y-4">
      <AdminPanel
        title="Organisations"
        subtitle="Agences, bailleurs individuels, plans, activité et signaux de risque."
        action={<span className="text-xs font-black text-slate-500">{rows.length} résultat(s)</span>}
      >
        <div className="mb-3 grid gap-2 lg:grid-cols-[1fr_180px_180px]">
          <label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher nom, email, téléphone..." className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400" />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold">
            <option value="all">Tous statuts</option>
            <option value="active">Actif</option>
            <option value="trial">Essai</option>
            <option value="suspended">Suspendu</option>
            <option value="cancelled">Annulé</option>
          </select>
          <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold">
            <option value="all">Tous types</option>
            <option value="agency">Agences</option>
            <option value="individual">Bailleurs individuels</option>
          </select>
        </div>
        <ResponsiveTable
          rows={rows}
          getKey={(agency) => agency.id}
          empty={<AdminEmptyState title="Aucune organisation" text="Ajustez la recherche ou les filtres." />}
          columns={[
            { key: 'name', label: 'Organisation', render: (agency) => <button type="button" onClick={() => onOpenAgency(agency)} className="text-left font-black text-slate-950 hover:text-emerald-800">{agency.name}<span className="block text-xs font-semibold text-slate-500">{agency.email ?? 'Email non renseigné'}</span></button> },
            { key: 'type', label: 'Type', render: (agency) => agency.is_bailleur_account ? 'Bailleur individuel' : 'Agence' },
            { key: 'plan', label: 'Plan', render: (agency) => <AdminStatusBadge tone="orange">{getAdminPlan(agency.plan).name}</AdminStatusBadge> },
            { key: 'status', label: 'Statut', render: (agency) => <AdminStatusBadge status={agency.status} /> },
            { key: 'usage', label: 'Usage', render: (agency) => `${agency.nb_users ?? 0} users · ${agency.nb_unites ?? 0} unités` },
            { key: 'volume', label: 'Volume', align: 'right', render: (agency) => <span className="font-black">{formatAdminCurrency(agency.volume_paiements)}</span> },
            { key: 'last', label: 'Activité', render: (agency) => formatAdminDate(agency.derniere_activite) },
          ]}
          renderCard={(agency) => (
            <button type="button" onClick={() => onOpenAgency(agency)} className="rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{agency.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{agency.email ?? 'Email non renseigné'}</p>
                </div>
                <AdminStatusBadge status={agency.status} />
              </div>
              <p className="mt-3 text-xs font-bold text-slate-600">{getAdminPlan(agency.plan).name} · {agency.nb_users ?? 0} users · {agency.nb_unites ?? 0} unités</p>
            </button>
          )}
        />
      </AdminPanel>
    </div>
  );
}
