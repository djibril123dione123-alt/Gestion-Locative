import { useMemo, useState } from 'react';
import { ShieldCheck, UserCheck, Users } from 'lucide-react';
import {
  AdminEmptyState,
  AdminKpiGrid,
  AdminListToolbar,
  AdminMetricCard,
  AdminPanel,
  AdminStatusBadge,
  ResponsiveTable,
} from '../../../components/console/AdminPrimitives';
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
  if (user.role === 'admin') return 'Administration protégée';
  if (user.role === 'comptable') return 'Finance et rapports';
  if (user.role === 'bailleur') return 'Espace propriétaire';
  return 'Accès opérationnel';
}

const roleOptions = [
  { value: 'all', label: 'Rôle' },
  { value: 'super_admin', label: 'Super-admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'agent', label: 'Agent' },
  { value: 'comptable', label: 'Comptable' },
  { value: 'bailleur', label: 'Bailleur' },
];

const statusOptions = [
  { value: 'all', label: 'Statut' },
  { value: 'active', label: 'Actifs' },
  { value: 'inactive', label: 'Inactifs' },
];

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
  const [status, setStatus] = useState('all');
  const users = useMemo(() => data.users.filter((user) => {
    const haystack = `${user.prenom ?? ''} ${user.nom ?? ''} ${user.email ?? ''} ${user.agency_name ?? ''}`.toLowerCase();
    const isActive = user.actif !== false;
    const matchesStatus = status === 'all'
      || (status === 'active' && isActive)
      || (status === 'inactive' && !isActive);
    return (!query || haystack.includes(query.toLowerCase()))
      && (role === 'all' || user.role === role)
      && matchesStatus;
  }), [data.users, query, role, status]);
  const adminCount = data.users.filter((user) => user.role === 'admin').length;
  const inactiveCount = data.users.filter((user) => user.actif === false).length;
  const superAdminCount = data.users.filter((user) => user.role === 'super_admin').length;

  return (
    <div className="space-y-3">
      <AdminKpiGrid maxItems={4}>
        <AdminMetricCard label="Actifs" value={data.platform.activeUsers} helper="Comptes utilisables" icon={Users} tone="emerald" onClick={() => { setRole('all'); setStatus('active'); }} />
        <AdminMetricCard label="Admins" value={adminCount} helper="Administrateurs tenant" icon={ShieldCheck} tone="blue" onClick={() => { setRole('admin'); setStatus('all'); }} />
        <AdminMetricCard label="Inactifs" value={inactiveCount} helper="Accès suspendus" icon={UserCheck} tone={inactiveCount ? 'amber' : 'slate'} onClick={() => { setRole('all'); setStatus('inactive'); }} />
        <AdminMetricCard label="RBAC" value="Actif" helper={`${superAdminCount} propriétaire(s)`} icon={ShieldCheck} />
      </AdminKpiGrid>

      <AdminPanel title="Utilisateurs & accès" subtitle="Rôles, rattachements tenant et garde-fous d’administration." bodyClassName="p-2 sm:p-2">
        <AdminListToolbar
          query={query}
          onQueryChange={setQuery}
          placeholder="Rechercher un utilisateur, un email ou une organisation..."
          resultCount={users.length}
          onReset={() => { setQuery(''); setRole('all'); setStatus('all'); }}
          isSplitOpen={Boolean(selectedUserId)}
          filters={[
            { value: role, placeholder: 'Rôle', options: roleOptions, onChange: setRole, defaultValue: 'all', className: 'w-[9rem]' },
            { value: status, placeholder: 'Statut', options: statusOptions, onChange: setStatus, defaultValue: 'all', className: 'w-[8.5rem]' },
          ]}
        />

        <ResponsiveTable<AdminUser>
          rows={users}
          getKey={(user) => user.id}
          selectedKey={selectedUserId}
          onRowClick={onOpenUser}
          rowAriaLabel={(user) => `Ouvrir la fiche utilisateur ${displayName(user)}`}
          empty={<AdminEmptyState title="Aucun utilisateur" text="Aucun profil ne correspond à ces filtres." />}
          columns={[
            {
              key: 'user',
              label: 'Utilisateur',
              className: selectedUserId ? 'w-[52%]' : undefined,
              render: (user) => (
                <span className="block min-w-0 text-left">
                  <span className="block truncate font-black text-slate-950">{displayName(user)}</span>
                  <span className="block truncate text-[0.68rem] font-semibold text-slate-500">
                    {user.email}
                    {selectedUserId ? ` · ${user.agency_name ?? 'Non rattaché'} · ${accessSummary(user)}` : ''}
                  </span>
                </span>
              ),
            },
            { key: 'agency', label: 'Organisation', hideWhenDetail: true, render: (user) => user.agency_name ?? 'Non rattaché' },
            { key: 'role', label: 'Rôle', render: (user) => <AdminStatusBadge tone={user.role === 'admin' || user.role === 'super_admin' ? 'blue' : 'slate'}>{roleLabel(user.role)}</AdminStatusBadge> },
            { key: 'status', label: 'Statut', render: (user) => <AdminStatusBadge status={user.actif === false ? 'suspended' : 'active'} /> },
            { key: 'risk', label: 'Garde-fou', hideWhenDetail: true, render: (user) => accessSummary(user) },
          ]}
          renderCard={(user) => (
            <button type="button" onClick={() => onOpenUser(user)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/30">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-black text-slate-950">{displayName(user)}</p>
                  <p className="truncate text-xs font-semibold text-slate-500">{user.email}</p>
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
