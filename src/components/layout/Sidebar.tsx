import { useMemo, useRef, useState, type ComponentType } from 'react';
import {
  AlertCircle,
  Bell,
  Building2,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
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
  X,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import {
  canAccessAccountPage,
  getAccountPageLabel,
  getEffectiveRoleForAccount,
} from '../../lib/accountProfile';
import type { UserPermissionMap } from '../../lib/rbac';
import type { AgencySettings } from '../../types/agency';
import { BrandMark } from '../brand/BrandLogo';

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
  icon: ComponentType<{ className?: string }>;
  roles: Role[];
  section?: string;
}

const NAV: MenuLeaf[] = [
  // PRINCIPAL
  {
    id: 'dashboard',
    label: "Vue d'ensemble",
    icon: LayoutDashboard,
    roles: ['admin', 'agent', 'comptable', 'bailleur'],
    section: 'PRINCIPAL',
  },
  // PORTEFEUILLE
  {
    id: 'bailleurs',
    label: 'Bailleurs',
    icon: UserCircle,
    roles: ['admin'],
    section: 'PORTEFEUILLE',
  },
  {
    id: 'patrimoine',
    label: 'Biens & Patrimoine',
    icon: Building2,
    roles: ['admin'],
  },
  {
    id: 'occupants-baux',
    label: 'Locations & Baux',
    icon: Users,
    roles: ['admin', 'agent', 'comptable'],
  },
  // FINANCES
  {
    id: 'paiements',
    label: 'Encaissements',
    icon: CreditCard,
    roles: ['admin', 'agent', 'comptable', 'bailleur'],
    section: 'FINANCES',
  },
  {
    id: 'loyers-impayes',
    label: 'Créances à recouvrer',
    icon: AlertCircle,
    roles: ['admin', 'agent', 'comptable', 'bailleur'],
  },
  {
    id: 'depenses',
    label: 'Dépenses & Charges',
    icon: TrendingDown,
    roles: ['admin'],
  },
  // EXPLOITATION
  {
    id: 'documents',
    label: 'Documents',
    icon: FolderOpen,
    roles: ['admin', 'agent'],
    section: 'EXPLOITATION',
  },
  {
    id: 'calendrier',
    label: 'Calendrier',
    icon: CalendarDays,
    roles: ['admin', 'agent'],
  },
  {
    id: 'interventions',
    label: 'Maintenance',
    icon: Wrench,
    roles: ['admin', 'agent'],
  },
  {
    id: 'inventaires',
    label: 'États des lieux',
    icon: ClipboardList,
    roles: ['admin', 'agent'],
  },
  // ADMINISTRATION
  {
    id: 'parametres',
    label: 'Paramètres agence',
    icon: Settings,
    roles: ['admin'],
    section: 'ADMINISTRATION',
  },
  {
    id: 'equipe',
    label: 'Équipe & Accès',
    icon: Users,
    roles: ['admin'],
  },
  {
    id: 'abonnement',
    label: 'Abonnement',
    icon: Wallet,
    roles: ['admin'],
  },
  {
    id: 'audit',
    label: 'Audit & Journal',
    icon: ClipboardList,
    roles: ['admin'],
  },
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

  // Auto-expansion au survol en mode réduit
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 180);
  };

  const isExpandedByHover = Boolean(isCollapsed && isHovered);
  const showExpandedContent = !isCollapsed || isOpen || isExpandedByHover;

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

  // Dimensions et positionnement en fonction du mode (épinglé vs auto-rétractable)
  const asideWidthClass = showExpandedContent ? 'w-56 lg:w-56' : 'w-56 lg:w-[3.75rem]';
  const asidePositionClass = isCollapsed ? 'lg:fixed lg:left-0 lg:top-0 lg:bottom-0 lg:z-50' : 'lg:static';
  const hoverShadowClass = isExpandedByHover ? 'lg:shadow-[24px_0_60px_rgba(0,0,0,0.55)]' : '';

  return (
    <>
      {/* Zone d'amorce invisible à l'extrême gauche en mode réduit */}
      {isCollapsed && !isOpen && (
        <div
          className="fixed left-0 top-0 bottom-0 z-40 hidden w-3.5 lg:block"
          onMouseEnter={handleMouseEnter}
        />
      )}

      {/* Overlay Mobile */}
      {isOpen && onClose && (
        <div className="fixed inset-0 z-40 bg-brand-950/60 backdrop-blur-sm animate-fadeIn lg:hidden" onClick={onClose} />
      )}

      {/* Spacer pour préserver l'espace dans App.tsx quand la sidebar est en fixed */}
      {isCollapsed && <div className="hidden lg:block lg:w-[3.75rem] lg:flex-shrink-0" />}

      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed inset-y-0 left-0 z-50 flex h-screen flex-col overflow-hidden border-r border-emerald-300/10 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.18),transparent_18rem),linear-gradient(180deg,#031f1a,#062b23_48%,#041b17)] text-white shadow-[18px_0_60px_rgba(2,6,23,0.28)]
          transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${asideWidthClass} ${asidePositionClass} ${hoverShadowClass}
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* EN-TÊTE DU SIDEBAR */}
        <div className={`relative flex items-center overflow-hidden border-b border-white/10 px-3 py-4 ${showExpandedContent ? 'justify-between' : 'justify-center'}`}>
          <div className="absolute -left-8 top-0 h-28 w-28 rounded-full bg-emerald-300/15 blur-2xl" />
          <div className="absolute right-0 top-0 h-px w-2/3 bg-gradient-to-r from-transparent via-orange-300/60 to-transparent" />
          <div className="relative flex min-w-0 items-center gap-2.5">
            <BrandMark size="sm" tone="dark" animated withTile={false} />
            <div className={`min-w-0 transition-opacity duration-200 ${showExpandedContent ? 'opacity-100' : 'hidden opacity-0'}`}>
              <p className="truncate text-xs font-black tracking-widest text-brand-paper">SAMAY KEUR</p>
              <p className="mt-0.5 truncate text-[10px] font-black uppercase tracking-widest text-action-500">Manage. Grow. Prosper.</p>
            </div>
          </div>

          <div className="relative flex items-center gap-1">
            {onToggleCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                className={`hidden rounded-xl p-2 transition-all duration-200 lg:inline-flex ${
                  isCollapsed
                    ? 'bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25'
                    : 'text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
                aria-label={isCollapsed ? 'Épingler la barre latérale' : 'Rétracter la barre latérale'}
                title={isCollapsed ? 'Épingler la barre latérale (garder ouverte)' : 'Rétracter la barre (ouverture automatique au survol)'}
              >
                {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
              </button>
            )}
            {onClose && (
              <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Fermer le menu">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* NAVIGATION DIRECTE PLAT (SANS SOUS-MENUS ACCORDÉONS) */}
        <nav className="flex-1 overflow-y-auto py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden xl:py-3">
          <ul className="space-y-1 px-2.5">
            {visibleNav.map((entry) => {
              const sectionHeader = entry.section && showExpandedContent ? (
                <li key={`sec-${entry.section}`} className="px-2.5 pb-1 pt-3.5 first:pt-1">
                  <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400/70">
                    {entry.section}
                  </span>
                </li>
              ) : null;

              const Icon = entry.icon;
              const active = isLeafActive(entry.id);

              return (
                <div key={entry.id}>
                  {sectionHeader}
                  <li>
                    <button
                      onClick={() => handleNavigate(entry.id)}
                      title={entry.label}
                      className={`group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 transition-all duration-200 ${
                        active
                          ? 'bg-gradient-to-r from-emerald-500/25 to-white/[0.05] font-extrabold text-white shadow-[0_4px_16px_rgba(0,0,0,0.25)] ring-1 ring-emerald-400/30'
                          : 'font-semibold text-slate-300 hover:bg-white/[0.065] hover:text-white'
                      } ${showExpandedContent ? '' : 'justify-center px-0'}`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]" />
                      )}
                      <Icon className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-emerald-300' : 'text-slate-400 group-hover:text-emerald-200'}`} />
                      {showExpandedContent && (
                        <span className="truncate text-xs tracking-wide">{entry.label}</span>
                      )}
                    </button>
                  </li>
                </div>
              );
            })}
          </ul>
        </nav>

        {/* FOOTER - COMPTE & ACTIONS EXECUTIVE */}
        <div className="relative border-t border-white/10 bg-black/20 p-3">
          <button
            type="button"
            onClick={() => setUserMenuOpen((value) => !value)}
            className={`w-full rounded-2xl border border-white/10 bg-white/[0.06] p-2.5 text-left shadow-lg transition hover:border-emerald-400/20 hover:bg-white/[0.09] ${showExpandedContent ? '' : 'flex justify-center px-0'}`}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-300 to-brand-700 text-xs font-black text-white shadow-md shadow-emerald-900/40">
                {initials}
              </div>
              {showExpandedContent && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-white">
                      {profile?.prenom} {profile?.nom}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="inline-block rounded-md bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-300 border border-emerald-400/20">
                        {profile?.role}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </button>

          {userMenuOpen && showExpandedContent && (
            <div className="absolute bottom-[4.8rem] left-3 right-3 z-30 overflow-hidden rounded-2xl border border-white/15 bg-brand-900/98 p-2 shadow-2xl shadow-black/70 backdrop-blur-xl animate-fadeIn">
              <div className="border-b border-white/10 px-2.5 py-2 mb-1">
                <p className="text-[11px] font-black text-white">{profile?.prenom} {profile?.nom}</p>
                <p className="text-[10px] font-bold text-emerald-300 capitalize">{profile?.role}</p>
              </div>
              <button
                type="button"
                onClick={() => handleNavigate('parametres?section=vue-ensemble')}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                <Settings className="h-4 w-4 text-emerald-300" />
                Paramètres agence
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('parametres?section=securite')}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Sécurité & Support
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('notifications')}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                <Bell className="h-4 w-4 text-emerald-300" />
                Centre de notifications
              </button>
              <div className="my-1 border-t border-white/10" />
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-orange-300 transition hover:bg-orange-500/15"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
