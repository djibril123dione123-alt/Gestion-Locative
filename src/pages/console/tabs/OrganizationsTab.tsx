import { useMemo, useState } from 'react';
import { AlertTriangle, Building2, CircleDollarSign, UserRound } from 'lucide-react';
import { getAdminPlan } from '../../../lib/admin/adminPricingCatalog';
import { buildRequiredActions, organizationTypeLabel } from '../../../lib/admin/adminInsights';
import { formatAdminCurrency, formatAdminDate, numberValue } from '../../../lib/admin/adminFormatters';
import { computeOrganizationHealth } from '../../../lib/admin/adminRiskScoring';
import {
  AdminEmptyState,
  AdminKpiGrid,
  AdminListToolbar,
  AdminMetricCard,
  AdminPanel,
  AdminStatusBadge,
  ResponsiveTable,
} from '../../../components/console/AdminPrimitives';
import type { AdminAgency, AdminConsoleData } from '../../../services/admin/adminConsoleService';

type SortKey = 'created' | 'activity' | 'plan' | 'revenue' | 'users' | 'units' | 'risk';

const statusOptions = [
  { value: 'all', label: 'Statut' },
  { value: 'active', label: 'Actives' },
  { value: 'trial', label: 'En essai' },
  { value: 'suspended', label: 'Suspendues' },
  { value: 'cancelled', label: 'Clôturées' },
  { value: 'payment_pending', label: 'Paiement à valider' },
];

const typeOptions = [
  { value: 'all', label: 'Type' },
  { value: 'agency', label: 'Agences' },
  { value: 'individual', label: 'Bailleurs individuels' },
  { value: 'mismatch', label: 'Type incohérent' },
];

const planOptions = [
  { value: 'all', label: 'Plan' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'business', label: 'Business' },
  { value: 'enterprise', label: 'Enterprise' },
];

const sortOptions = [
  { value: 'risk', label: 'Risque' },
  { value: 'activity', label: 'Activité récente' },
  { value: 'created', label: 'Création récente' },
  { value: 'plan', label: 'Plan supérieur' },
  { value: 'revenue', label: 'Volume financier' },
  { value: 'users', label: 'Utilisateurs' },
  { value: 'units', label: 'Unités' },
];

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
  const riskyIds = useMemo(
    () => new Set(requiredActions.filter((action) => action.organizationId && action.priority >= 75).map((action) => action.organizationId)),
    [requiredActions],
  );
  const pendingPaymentIds = useMemo(
    () => new Set(data.proofs.filter((proof) => proof.status === 'pending').map((proof) => proof.agency_id)),
    [data.proofs],
  );

  const rows = useMemo(() => data.agencies.filter((agency) => {
    const haystack = `${agency.name} ${agency.email ?? ''} ${agency.phone ?? ''} ${agency.id}`.toLowerCase();
    const matchQuery = !query || haystack.includes(query.toLowerCase());
    const matchStatus = status === 'all'
      || (agency.status ?? 'active') === status
      || (status === 'payment_pending' && pendingPaymentIds.has(agency.id));
    const agencyType = agency.is_bailleur_account || agency.organization_type === 'individual_landlord' ? 'individual' : 'agency';
    const matchType = type === 'all'
      || agencyType === type
      || (type === 'mismatch' && Boolean(agency.is_bailleur_account && agency.organization_type && agency.organization_type !== 'individual_landlord'));
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

  const resetFilters = () => {
    setQuery('');
    setStatus('all');
    setType('all');
    setPlan('all');
    setSort('risk');
  };

  return (
    <div className="space-y-3">
      <AdminKpiGrid maxItems={4}>
        <AdminMetricCard label="Agences" value={agencies} helper="Comptes professionnels" icon={Building2} tone="emerald" onClick={() => setType('agency')} />
        <AdminMetricCard label="Bailleurs" value={individuals} helper="Profils propriétaires" icon={UserRound} tone="blue" onClick={() => setType('individual')} />
        <AdminMetricCard label="Paiements" value={pendingPaymentIds.size} helper="Preuves à valider" icon={CircleDollarSign} tone={pendingPaymentIds.size ? 'amber' : 'emerald'} onClick={() => setStatus('payment_pending')} />
        <AdminMetricCard label="À vérifier" value={mismatches + riskyIds.size} helper="Risques ou types" icon={AlertTriangle} tone={mismatches + riskyIds.size ? 'amber' : 'slate'} onClick={() => { setType(mismatches ? 'mismatch' : 'all'); setSort('risk'); }} />
      </AdminKpiGrid>

      <AdminPanel
        title="Organisations"
        subtitle="Comptes, santé opérationnelle, plans et usage."
        bodyClassName="p-2 sm:p-2"
      >
        <AdminListToolbar
          query={query}
          onQueryChange={setQuery}
          placeholder="Rechercher une organisation, un email ou un téléphone..."
          resultCount={rows.length}
          onReset={resetFilters}
          isSplitOpen={Boolean(selectedAgencyId)}
          filters={[
            { value: status, placeholder: 'Statut', options: statusOptions, onChange: setStatus, defaultValue: 'all' },
            { value: type, placeholder: 'Type', options: typeOptions, onChange: setType, defaultValue: 'all' },
            { value: plan, placeholder: 'Plan', options: planOptions, onChange: setPlan, defaultValue: 'all' },
            { value: sort, placeholder: 'Trier', options: sortOptions, onChange: (value) => setSort(value as SortKey), defaultValue: 'risk' },
          ]}
        />

        <ResponsiveTable<AdminAgency>
          rows={rows}
          getKey={(agency) => agency.id}
          selectedKey={selectedAgencyId}
          onRowClick={onOpenAgency}
          rowAriaLabel={(agency) => `Ouvrir la fiche organisation ${agency.name}`}
          empty={<AdminEmptyState title="Aucune organisation" text="Aucune organisation ne correspond à ces filtres." />}
          columns={[
            {
              key: 'name',
              label: 'Organisation',
              className: selectedAgencyId ? 'w-[48%]' : undefined,
              render: (agency) => (
                <span className="block min-w-0 text-left">
                  <span className="block truncate text-[0.76rem] font-semibold text-slate-950">{agency.name}</span>
                  <span className="block truncate text-[0.68rem] font-semibold text-slate-500">
                    {agency.email ?? 'Email non renseigné'}
                    {selectedAgencyId ? ` · ${getAdminPlan(agency.plan).name} · ${organizationTypeLabel(agency)}` : ''}
                  </span>
                </span>
              ),
            },
            { key: 'type', label: 'Type', hideWhenDetail: true, render: (agency) => <AdminStatusBadge tone="slate">{organizationTypeLabel(agency)}</AdminStatusBadge> },
            { key: 'plan', label: 'Plan', hideWhenDetail: true, render: (agency) => <AdminStatusBadge tone="orange">{getAdminPlan(agency.plan).name}</AdminStatusBadge> },
            { key: 'status', label: 'Statut', render: (agency) => <AdminStatusBadge status={agency.status} /> },
            {
              key: 'health',
              label: 'Santé',
              render: (agency) => {
                const health = computeOrganizationHealth(agency, data.subscriptions.find((sub) => sub.agency_id === agency.id), data.proofs.filter((proof) => proof.agency_id === agency.id));
                return <AdminStatusBadge tone={health.level === 'healthy' ? 'emerald' : health.level === 'watch' ? 'amber' : 'red'}>{health.score}/100</AdminStatusBadge>;
              },
            },
            { key: 'usage', label: 'Usage', hideWhenDetail: true, render: (agency) => `${agency.nb_users ?? 0} utilisateur(s) · ${agency.nb_unites ?? 0} unité(s)` },
            { key: 'volume', label: 'Volume', align: 'right', hideWhenDetail: true, render: (agency) => <span className="font-semibold">{formatAdminCurrency(agency.volume_paiements)}</span> },
            { key: 'last', label: 'Activité', hideWhenDetail: true, render: (agency) => formatAdminDate(agency.derniere_activite) },
          ]}
          renderCard={(agency) => (
            <button type="button" onClick={() => onOpenAgency(agency)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/30">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[0.78rem] font-semibold text-slate-950">{agency.name}</p>
                  <p className="truncate text-xs font-semibold text-slate-500">{agency.email ?? 'Email non renseigné'}</p>
                </div>
                <AdminStatusBadge status={agency.status} />
              </div>
              <p className="mt-2 text-xs font-bold text-slate-600">{getAdminPlan(agency.plan).name} · {agency.nb_users ?? 0} utilisateur(s) · {agency.nb_unites ?? 0} unité(s)</p>
            </button>
          )}
        />
      </AdminPanel>
    </div>
  );
}
