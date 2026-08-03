import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  TrendingDown,
  UserCircle,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import {
  canAccessAccountPage,
  getAccountPageLabel,
  getEffectiveRoleForAccount,
} from '../../lib/accountProfile';
import type { UserPermissionMap } from '../../lib/rbac';
import type { AgencySettings } from '../../types/agency';
import { AppSidebarFrame } from './AppSidebarFrame';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
  moduleSettings?: Partial<
    Pick<
      AgencySettings,
      | 'module_depenses_actif'
      | 'module_inventaires_actif'
      | 'module_interventions_actif'
      | 'mode_avance_actif'
      | 'qr_code_quittances'
      | 'enabled_modules'
    >
  > | null;
  userPermissions?: UserPermissionMap | null;
}

type Role = 'admin' | 'agent' | 'comptable' | 'bailleur';

interface MenuLeaf {
  id: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  section?: string;
}

const NAV: MenuLeaf[] = [
  { id: 'dashboard', label: "Vue d'ensemble", icon: LayoutDashboard, roles: ['admin', 'agent', 'comptable', 'bailleur'], section: 'PRINCIPAL' },
  { id: 'bailleurs', label: 'Bailleurs', icon: UserCircle, roles: ['admin'], section: 'PORTEFEUILLE' },
  { id: 'patrimoine', label: 'Biens & Patrimoine', icon: Building2, roles: ['admin'] },
  { id: 'occupants-baux', label: 'Locations & Baux', icon: Users, roles: ['admin', 'agent', 'comptable'] },
  { id: 'paiements', label: 'Encaissements', icon: CreditCard, roles: ['admin', 'agent', 'comptable', 'bailleur'], section: 'FINANCES' },
  { id: 'loyers-impayes', label: 'Créances à recouvrer', icon: AlertCircle, roles: ['admin', 'agent', 'comptable', 'bailleur'] },
  { id: 'depenses', label: 'Dépenses & Charges', icon: TrendingDown, roles: ['admin'] },
  { id: 'documents', label: 'Documents', icon: FolderOpen, roles: ['admin', 'agent'], section: 'EXPLOITATION' },
  { id: 'calendrier', label: 'Calendrier', icon: CalendarDays, roles: ['admin', 'agent'] },
  { id: 'interventions', label: 'Maintenance', icon: Wrench, roles: ['admin', 'agent'] },
  { id: 'inventaires', label: 'États des lieux', icon: ClipboardList, roles: ['admin', 'agent'] },
  { id: 'parametres', label: 'Paramètres agence', icon: Settings, roles: ['admin'], section: 'ADMINISTRATION' },
  { id: 'equipe', label: 'Équipe & Accès', icon: Users, roles: ['admin'] },
  { id: 'abonnement', label: 'Abonnement', icon: Wallet, roles: ['admin'] },
  { id: 'audit', label: 'Audit & Journal', icon: ClipboardList, roles: ['admin'] },
];

export function Sidebar({
  currentPage,
  onNavigate,
  isOpen = true,
  onClose,
  isCollapsed = false,
  onToggleCollapsed,
  moduleSettings,
  userPermissions,
}: SidebarProps) {
  const { profile, accountProfile, signOut } = useAuth();
  const role = getEffectiveRoleForAccount((profile?.role ?? 'agent') as Role, accountProfile) as Role;
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const visibleNav = useMemo(() => {
    if (!profile || profile.role === 'super_admin') return [] as MenuLeaf[];
    return NAV
      .filter((entry) => entry.roles.includes(role) && canAccessAccountPage(profile.role, entry.id, accountProfile, moduleSettings, userPermissions))
      .map((entry) => ({
        ...entry,
        label: getAccountPageLabel(entry.id, accountProfile) ?? entry.label,
      }));
  }, [accountProfile, moduleSettings, profile, role, userPermissions]);

  const handleNavigate = (page: string) => {
    onNavigate(page);
    onClose?.();
    setUserMenuOpen(false);
  };

  const isLeafActive = (id: string) => {
    if (currentPage === id) return true;
    if (id === 'patrimoine') return currentPage === 'immeubles' || currentPage === 'unites';
    if (id === 'occupants-baux') return currentPage === 'locataires' || currentPage === 'contrats';
    return false;
  };

  const initials = `${profile?.prenom?.[0] ?? 'A'}${profile?.nom?.[0] ?? 'S'}`;

  return (
    <AppSidebarFrame
      items={visibleNav}
      activeItem={currentPage}
      onNavigate={handleNavigate}
      isOpen={isOpen}
      onClose={onClose}
      isCollapsed={isCollapsed}
      onToggleCollapsed={onToggleCollapsed}
      isItemActive={isLeafActive}
      footer={(expanded) => (
        <>
          <button
            type="button"
            onClick={() => setUserMenuOpen((value) => !value)}
            className={`w-full rounded-2xl border border-white/10 bg-white/[0.06] p-2.5 text-left shadow-lg transition hover:border-emerald-400/20 hover:bg-white/[0.09] ${expanded ? '' : 'flex justify-center px-0'}`}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-300 to-brand-700 text-xs font-black text-white shadow-md shadow-emerald-900/40">
                {initials}
              </div>
              {expanded && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-white">{profile?.prenom} {profile?.nom}</p>
                  <span className="mt-0.5 inline-block rounded-md border border-emerald-400/20 bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-300">
                    {profile?.role}
                  </span>
                </div>
              )}
            </div>
          </button>

          {userMenuOpen && expanded && (
            <div className="absolute bottom-[4.8rem] left-3 right-3 z-30 overflow-hidden rounded-2xl border border-white/15 bg-brand-900/98 p-2 shadow-2xl shadow-black/70 backdrop-blur-xl animate-fadeIn">
              <div className="mb-1 border-b border-white/10 px-2.5 py-2">
                <p className="text-[11px] font-black text-white">{profile?.prenom} {profile?.nom}</p>
                <p className="text-[10px] font-bold capitalize text-emerald-300">{profile?.role}</p>
              </div>
              <button type="button" onClick={() => handleNavigate('parametres?section=vue-ensemble')} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 hover:text-white">
                <Settings className="h-4 w-4 text-emerald-300" />
                Paramètres agence
              </button>
              <button type="button" onClick={() => handleNavigate('parametres?section=securite')} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 hover:text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Sécurité & Support
              </button>
              <button type="button" onClick={() => handleNavigate('notifications')} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 hover:text-white">
                <Bell className="h-4 w-4 text-emerald-300" />
                Centre de notifications
              </button>
              <div className="my-1 border-t border-white/10" />
              <button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-orange-300 transition hover:bg-orange-500/15">
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          )}
        </>
      )}
    />
  );
}
