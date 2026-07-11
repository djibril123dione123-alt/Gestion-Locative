import { Mail, ShieldCheck, UserCog, XCircle } from 'lucide-react';
import { PremiumDrawerShell } from '../ui/PremiumDrawerShell';
import { PremiumButton } from '../ui/PremiumButton';
import { AdminMetricCard, AdminPanel, AdminStatusBadge } from './AdminPrimitives';
import { formatAdminDate, textValue } from '../../lib/admin/adminFormatters';
import type { AdminUser } from '../../services/admin/adminConsoleService';

const ROLE_OPTIONS: Array<{ id: 'admin' | 'agent' | 'comptable' | 'bailleur'; label: string; description: string }> = [
  { id: 'admin', label: 'Admin', description: 'Pilotage complet de l’espace agence et des paramètres.' },
  { id: 'agent', label: 'Agent', description: 'Gestion opérationnelle selon les permissions agence.' },
  { id: 'comptable', label: 'Comptable', description: 'Finance, encaissements et rapports selon accès.' },
  { id: 'bailleur', label: 'Bailleur', description: 'Lecture propriétaire lorsque ce rôle est utilisé.' },
];

function userDisplayName(user: AdminUser) {
  const fullName = `${user.prenom ?? ''} ${user.nom ?? ''}`.trim();
  return fullName || user.email || 'Utilisateur';
}

function initials(user: AdminUser) {
  const source = userDisplayName(user);
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';
}

export function UserAccessDrawer({
  user,
  users,
  onClose,
  onChangeRole,
  onChangeStatus,
}: {
  user: AdminUser | null;
  users: AdminUser[];
  onClose: () => void;
  onChangeRole: (user: AdminUser, role: 'admin' | 'agent' | 'comptable' | 'bailleur') => void;
  onChangeStatus: (user: AdminUser, active: boolean) => void;
}) {
  if (!user) return null;

  const active = user.actif !== false;
  const sameAgencyUsers = users.filter((candidate) => candidate.agency_id === user.agency_id);
  const activeAdmins = sameAgencyUsers.filter((candidate) => candidate.role === 'admin' && candidate.actif !== false);
  const protectedAdmin = user.role === 'super_admin' || (user.role === 'admin' && active && activeAdmins.length <= 1);
  const visiblePages = user.role === 'admin' || user.role === 'super_admin' ? 'Toutes les pages agence' : user.role === 'comptable' ? 'Finance + rapports' : user.role === 'bailleur' ? 'Espace propriétaire' : 'Portefeuille + documents';

  return (
    <PremiumDrawerShell
      open
      title={userDisplayName(user)}
      eyebrow="Fiche utilisateur"
      description="Contrôlez le rôle, le statut et les garde-fous avant toute mutation."
      onClose={onClose}
      size="wide"
      density="compact"
      desktopMode="edge"
      desktopAt="lg"
      avatar={
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-950 text-sm font-black text-white shadow-sm">
          {initials(user)}
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <AdminMetricCard label="Statut" value={active ? 'Actif' : 'Suspendu'} icon={ShieldCheck} tone={active ? 'emerald' : 'amber'} />
          <AdminMetricCard label="Rôle" value={user.role ?? 'Non défini'} icon={UserCog} tone={user.role === 'admin' ? 'blue' : 'slate'} />
          <AdminMetricCard label="Accès" value={visiblePages} icon={Mail} />
        </div>

        <AdminPanel title="Identité & rattachement" subtitle="Données issues de user_profiles et du tenant rattaché.">
          <div className="grid gap-2 text-sm">
            {[
              ['Email', textValue(user.email)],
              ['Organisation', textValue(user.agency_name, 'Non rattaché')],
              ['Date création', formatAdminDate(user.created_at)],
              ['Protection', protectedAdmin ? 'Dernier admin ou super-admin protégé' : 'Modifiable avec audit'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
                <span className="text-[0.68rem] font-black uppercase tracking-[0.1em] text-slate-500">{label}</span>
                <span className="text-right font-bold text-slate-900">{value}</span>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="Changer le rôle" subtitle="Aucun rôle super-admin n’est attribuable depuis cette fiche.">
          <div className="grid gap-2">
            {ROLE_OPTIONS.map((role) => {
              const current = user.role === role.id;
              const disabled = current || user.role === 'super_admin' || (protectedAdmin && role.id !== 'admin');
              return (
                <button
                  key={role.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChangeRole(user, role.id)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-emerald-300 hover:bg-emerald-50/45 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-950">{role.label}</p>
                    {current ? <AdminStatusBadge tone="emerald">Actuel</AdminStatusBadge> : <AdminStatusBadge tone="slate">Disponible</AdminStatusBadge>}
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{role.description}</p>
                </button>
              );
            })}
          </div>
        </AdminPanel>

        <AdminPanel title="Statut du compte" subtitle="La désactivation conserve le profil mais bloque l’exploitation côté agence.">
          <div className="flex flex-col gap-2 sm:flex-row">
            <PremiumButton
              variant={active ? 'danger' : 'primary'}
              size="sm"
              fullWidth
              disabled={user.role === 'super_admin' || (active && protectedAdmin)}
              icon={active ? <XCircle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              onClick={() => onChangeStatus(user, !active)}
            >
              {active ? 'Désactiver le compte' : 'Réactiver le compte'}
            </PremiumButton>
          </div>
          {protectedAdmin && (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
              Garde-fou actif : cette organisation doit conserver au moins un administrateur actif.
            </p>
          )}
        </AdminPanel>
      </div>
    </PremiumDrawerShell>
  );
}
