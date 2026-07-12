import { useMemo, useState } from 'react';
import { Search, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { AdminEmptyState, AdminKpiGrid, AdminMetricCard, AdminPanel, AdminStatusBadge, ResponsiveTable } from '../../../components/console/AdminPrimitives';
import type { AdminConsoleData, AdminUser } from '../../../services/admin/adminConsoleService';

function displayName(user: AdminUser) {
  const name = `${user.prenom ?? ''} ${user.nom ?? ''}`.trim();
  return name || user.email || 'Utilisateur';
}

function roleLabel(role: string | null) {
  const labels: Record<string, string> = {
    super_admin: 'Super-admin',
    admin: 'Admin',
    agent: 'Agent',
    comptable: 'Comptable',
    bailleur: 'Bailleur',
  };
  return labels[role ?? ''] ?? role ?? 'Non défini';
}

function accessSummary(user: AdminUser) {
  if (user.role === 'super_admin') return 'Plateforme complète';
  if (user.role === 'admin') return 'Admin protégé';
  if (user.role === 'comptable') return 'Finance et rapports';
  if (user.role === 'bailleur') return 'Espace propriétaire';
  return 'Accès tenant';
}

export function UsersAccessTab({
  data,
  onOpenUser,
  selectedUserId,
}: {
  data: AdminConsoleData;
  onOpenUser: (user: AdminUser) => void;
  selectedUserId?: string | null;
}) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const users = useMemo(() => data.users.filter((user) => {
    const haystack = `${user.prenom ?? ''} ${user.nom ?? ''} ${user.email ?? ''} ${user.agency_name ?? ''}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (role === 'all' || user.role === role);
  }), [data.users, query, role]);
  const adminCount = data.users.filter((user) => user.role === 'admin').length;
  const inactiveCount = data.users.filter((user) => user.actif === false).length;
  const superAdminCount = data.users.filter((user) => user.role === 'super_admin').length;

  return (
    <div className="space-y-3">
      <AdminKpiGrid maxItems={4}>
        <AdminMetricCard label="Actifs" value={data.platform.activeUsers} helper="Comptes utilisables" icon={Users} tone="emerald" />
        <AdminMetricCard label="Admins" value={adminCount} helper="Tenant protégés" icon={ShieldCheck} tone="blue" />
        <AdminMetricCard label="Inactifs" value={inactiveCount} helper="Accès bloqués" icon={UserCheck} tone={inactiveCount ? 'amber' : 'slate'} />
        <AdminMetricCard label="RBAC" value="Actif" helper={`${superAdminCount} owner`} icon={ShieldCheck} />
      </AdminKpiGrid>

      <AdminPanel title="Utilisateurs & accès" subtitle="Comptes, rôles, rattachements tenant et garde-fous d’administration.">
        <div className="mb-3 grid gap-2 2xl:grid-cols-[1fr_160px]">
          <label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher utilisateur, email, organisation..."
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
            />
          </label>
          <select value={role} onChange={(event) => setRole(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold">
            <option value="all">Tous rôles</option>
            <option value="super_admin">Super-admin</option>
            <option value="admin">Admin</option>
            <option value="agent">Agent</option>
            <option value="comptable">Comptable</option>
            <option value="bailleur">Bailleur</option>
          </select>
        </div>

        <ResponsiveTable<AdminUser>
          rows={users}
          getKey={(user) => user.id}
          selectedKey={selectedUserId}
          onRowClick={onOpenUser}
          rowAriaLabel={(user) => `Ouvrir la fiche utilisateur ${displayName(user)}`}
          empty={<AdminEmptyState title="Aucun utilisateur" text="Ajustez la recherche ou le filtre de rôle." />}
          columns={[
            {
              key: 'user',
              label: 'Utilisateur',
              render: (user) => (
                <span className="text-left font-black text-slate-950">
                  {displayName(user)}
                  <span className="block text-xs font-semibold text-slate-500">{user.email}</span>
                </span>
              ),
            },
            { key: 'agency', label: 'Organisation', render: (user) => user.agency_name ?? 'Non rattaché' },
            { key: 'role', label: 'Rôle', render: (user) => <AdminStatusBadge tone={user.role === 'admin' || user.role === 'super_admin' ? 'blue' : 'slate'}>{roleLabel(user.role)}</AdminStatusBadge> },
            { key: 'status', label: 'Statut', render: (user) => <AdminStatusBadge status={user.actif === false ? 'suspended' : 'active'} /> },
            { key: 'risk', label: 'Garde-fou', render: (user) => accessSummary(user) },
          ]}
          renderCard={(user) => (
            <button type="button" onClick={() => onOpenUser(user)} className="rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{displayName(user)}</p>
                  <p className="text-xs font-semibold text-slate-500">{user.email}</p>
                </div>
                <AdminStatusBadge tone={user.role === 'admin' || user.role === 'super_admin' ? 'blue' : 'slate'}>{roleLabel(user.role)}</AdminStatusBadge>
              </div>
              <p className="mt-2 text-xs font-bold text-slate-600">{user.agency_name ?? 'Non rattaché'} · {accessSummary(user)}</p>
            </button>
          )}
        />
      </AdminPanel>
    </div>
  );
}
