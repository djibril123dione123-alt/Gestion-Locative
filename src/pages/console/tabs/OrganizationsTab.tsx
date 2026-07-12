import { useMemo, useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { getAdminPlan } from '../../../lib/admin/adminPricingCatalog';
import { buildRequiredActions, organizationTypeLabel } from '../../../lib/admin/adminInsights';
import { formatAdminCurrency, formatAdminDate, numberValue } from '../../../lib/admin/adminFormatters';
import { computeOrganizationHealth } from '../../../lib/admin/adminRiskScoring';
import { AdminEmptyState, AdminKpiGrid, AdminMetricCard, AdminPanel, AdminStatusBadge, ResponsiveTable } from '../../../components/console/AdminPrimitives';
import type { AdminAgency, AdminConsoleData } from '../../../services/admin/adminConsoleService';

type SortKey = 'created' | 'activity' | 'plan' | 'revenue' | 'users' | 'units' | 'risk';

export function OrganizationsTab({
  data,
  onOpenAgency,
  selectedAgencyId,
}: {
  data: AdminConsoleData;
  onOpenAgency: (agency: AdminAgency) => void;
  selectedAgencyId?: string | null;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [plan, setPlan] = useState('all');
  const [sort, setSort] = useState<SortKey>('risk');

  const requiredActions = useMemo(() => buildRequiredActions(data), [data]);
  const riskyIds = new Set(requiredActions.filter((action) => action.organizationId && action.priority >= 75).map((action) => action.organizationId));
  const pendingPaymentIds = useMemo(() => new Set(data.proofs.filter((proof) => proof.status === 'pending').map((proof) => proof.agency_id)), [data.proofs]);

  const rows = useMemo(() => data.agencies.filter((agency) => {
    const haystack = `${agency.name} ${agency.email ?? ''} ${agency.phone ?? ''} ${agency.id}`.toLowerCase();
    const matchQuery = !query || haystack.includes(query.toLowerCase());
    const matchStatus = status === 'all' || (agency.status ?? 'active') === status || (status === 'payment_pending' && pendingPaymentIds.has(agency.id));
    const agencyType = agency.is_bailleur_account || agency.organization_type === 'individual_landlord' ? 'individual' : 'agency';
    const matchType = type === 'all' || agencyType === type || (type === 'mismatch' && Boolean(agency.is_bailleur_account && agency.organization_type && agency.organization_type !== 'individual_landlord'));
    const matchPlan = plan === 'all' || getAdminPlan(agency.plan).id === plan;
    return matchQuery && matchStatus && matchType && matchPlan;
  }).sort((a, b) => {
    if (sort === 'created') return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    if (sort === 'activity') return new Date(b.derniere_activite ?? 0).getTime() - new Date(a.derniere_activite ?? 0).getTime();
    if (sort === 'plan') return getAdminPlan(b.plan).price_xof - getAdminPlan(a.plan).price_xof;
    if (sort === 'revenue') return numberValue(b.volume_paiements) - numberValue(a.volume_paiements);
    if (sort === 'users') return numberValue(b.nb_users) - numberValue(a.nb_users);
    if (sort === 'units') return numberValue(b.nb_unites) - numberValue(a.nb_unites);
    const healthA = computeOrganizationHealth(a, data.subscriptions.find((sub) => sub.agency_id === a.id), data.proofs.filter((proof) => proof.agency_id === a.id)).score;
    const healthB = computeOrganizationHealth(b, data.subscriptions.find((sub) => sub.agency_id === b.id), data.proofs.filter((proof) => proof.agency_id === b.id)).score;
    return healthA - healthB;
  }), [data.agencies, data.proofs, data.subscriptions, pendingPaymentIds, plan, query, sort, status, type]);

  const agencies = data.agencies.filter((agency) => !agency.is_bailleur_account && agency.organization_type !== 'individual_landlord').length;
  const individuals = data.agencies.length - agencies;
  const mismatches = data.agencies.filter((agency) => agency.is_bailleur_account && agency.organization_type && agency.organization_type !== 'individual_landlord').length;

  return (
    <div className="space-y-3">
      <AdminKpiGrid maxItems={4}>
        <AdminMetricCard label="Agences" value={agencies} helper="Comptes pro" tone="emerald" />
        <AdminMetricCard label="Bailleurs" value={individuals} helper="Profils owner" tone="blue" />
        <AdminMetricCard label="Paiements" value={pendingPaymentIds.size} helper="À valider" tone={pendingPaymentIds.size ? 'amber' : 'emerald'} />
        <AdminMetricCard label="À vérifier" value={mismatches + riskyIds.size} helper="Risque ou type" icon={AlertTriangle} tone={mismatches + riskyIds.size ? 'amber' : 'slate'} />
      </AdminKpiGrid>

      <AdminPanel
        title="Organisations"
        subtitle="Recherche, filtres, santé, plan, activité et signaux de risque."
        action={<span className="text-xs font-black text-slate-500">{rows.length} résultat(s)</span>}
      >
        <div className="mb-3 grid gap-2 xl:grid-cols-[1fr_150px_150px_140px_150px]">
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
            <option value="payment_pending">Paiement attente</option>
          </select>
          <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold">
            <option value="all">Tous types</option>
            <option value="agency">Agences</option>
            <option value="individual">Bailleurs</option>
            <option value="mismatch">Type incohérent</option>
          </select>
          <select value={plan} onChange={(event) => setPlan(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold">
            <option value="all">Tous plans</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold">
            <option value="risk">Tri risque</option>
            <option value="activity">Activité</option>
            <option value="created">Création</option>
            <option value="plan">Plan</option>
            <option value="revenue">Volume</option>
            <option value="users">Utilisateurs</option>
            <option value="units">Unités</option>
          </select>
        </div>

        <ResponsiveTable<AdminAgency>
          rows={rows}
          getKey={(agency) => agency.id}
          selectedKey={selectedAgencyId}
          onRowClick={onOpenAgency}
          rowAriaLabel={(agency) => `Ouvrir la fiche organisation ${agency.name}`}
          empty={<AdminEmptyState title="Aucune organisation" text="Ajustez la recherche ou les filtres." />}
          columns={[
            {
              key: 'name',
              label: 'Organisation',
              render: (agency) => (
                <span className="text-left font-black text-slate-950">
                  {agency.name}
                  <span className="block text-xs font-semibold text-slate-500">{agency.email ?? 'Email non renseigné'}</span>
                </span>
              ),
            },
            { key: 'type', label: 'Type', render: (agency) => <AdminStatusBadge tone="slate">{organizationTypeLabel(agency)}</AdminStatusBadge> },
            { key: 'plan', label: 'Plan', render: (agency) => <AdminStatusBadge tone="orange">{getAdminPlan(agency.plan).name}</AdminStatusBadge> },
            { key: 'status', label: 'Statut', render: (agency) => <AdminStatusBadge status={agency.status} /> },
            {
              key: 'health',
              label: 'Santé',
              render: (agency) => {
                const health = computeOrganizationHealth(agency, data.subscriptions.find((sub) => sub.agency_id === agency.id), data.proofs.filter((proof) => proof.agency_id === agency.id));
                return <AdminStatusBadge tone={health.level === 'healthy' ? 'emerald' : health.level === 'watch' ? 'amber' : 'red'}>{health.score}/100</AdminStatusBadge>;
              },
            },
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
