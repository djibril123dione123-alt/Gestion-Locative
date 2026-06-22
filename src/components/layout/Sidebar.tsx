import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  AlertCircle,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  CreditCard,
  FolderOpen,
  HardHat,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Settings,
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
  getAccountGroupCopy,
  getAccountPageLabel,
  getEffectiveRoleForAccount,
} from '../../lib/accountProfile';
import type { UserPermissionMap } from '../../lib/rbac';
import type { AgencySettings } from '../../types/agency';
import { BrandMark } from '../brand/BrandLogo';
import { NotificationBell } from '../ui/NotificationBell';

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
      'module_depenses_actif' | 'module_inventaires_actif' | 'module_interventions_actif' | 'mode_avance_actif'
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
}

interface MenuGroup {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  roles: Role[];
  items: MenuLeaf[];
}

const NAV: Array<MenuLeaf | MenuGroup> = [
  {
    id: 'dashboard',
    label: "Vue d'ensemble",
    icon: LayoutDashboard,
    roles: ['admin', 'agent', 'comptable', 'bailleur'],
  },
  {
    id: 'portefeuille',
    label: 'Portefeuille',
    description: 'Bailleur → bien → unité → location',
    icon: Building2,
    roles: ['admin', 'agent', 'comptable', 'bailleur'],
    items: [
      { id: 'bailleurs', label: 'Bailleurs', icon: UserCircle, roles: ['admin'] },
      { id: 'patrimoine', label: 'Biens', icon: Building2, roles: ['admin'] },
      { id: 'occupants-baux', label: 'Locations', icon: Users, roles: ['admin', 'agent', 'comptable'] },
    ],
  },
  {
    id: 'finance',
    label: 'Finances',
    description: 'Paiements, créances et dépenses',
    icon: Wallet,
    roles: ['admin', 'agent', 'comptable', 'bailleur'],
    items: [
      { id: 'paiements', label: 'Encaissements', icon: CreditCard, roles: ['admin', 'agent', 'comptable', 'bailleur'] },
      { id: 'loyers-impayes', label: 'Créances à recouvrer', icon: AlertCircle, roles: ['admin', 'agent', 'comptable', 'bailleur'] },
      { id: 'depenses', label: 'Dépenses', icon: TrendingDown, roles: ['admin'] },
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: FolderOpen,
    roles: ['admin', 'agent'],
  },
  {
    id: 'operations',
    label: 'Terrain',
    description: 'Planning, maintenance et etats des lieux',
    icon: HardHat,
    roles: ['admin', 'agent'],
    items: [
      { id: 'calendrier', label: 'Calendrier', icon: CalendarDays, roles: ['admin', 'agent'] },
      { id: 'interventions', label: 'Maintenance', icon: Wrench, roles: ['admin', 'agent'] },
      { id: 'inventaires', label: 'Etats des lieux', icon: ClipboardList, roles: ['admin', 'agent'] },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    description: 'Parametres, equipe, abonnement et controle',
    icon: Settings,
    roles: ['admin'],
    items: [
      { id: 'parametres', label: 'Parametres', icon: Settings, roles: ['admin'] },
      { id: 'equipe', label: 'Equipe & acces', icon: Users, roles: ['admin'] },
      { id: 'abonnement', label: 'Abonnement', icon: CreditCard, roles: ['admin'] },
      { id: 'audit', label: 'Journal & audit', icon: ClipboardList, roles: ['admin'] },
    ],
  },
];

const PARENT_OF: Record<string, string> = {
  bailleurs: 'portefeuille',
  patrimoine: 'portefeuille',
  immeubles: 'portefeuille',
  unites: 'portefeuille',
  locataires: 'portefeuille',
  contrats: 'portefeuille',
  'occupants-baux': 'portefeuille',
  paiements: 'finance',
  'loyers-impayes': 'finance',
  depenses: 'finance',
  'tableau-de-bord-financier': 'finance',
  'filtres-avances': 'finance',
  calendrier: 'operations',
  interventions: 'operations',
  inventaires: 'operations',
  parametres: 'administration',
  equipe: 'administration',
  abonnement: 'administration',
  audit: 'administration',
};

function isGroup(entry: MenuLeaf | MenuGroup): entry is MenuGroup {
  return 'items' in entry;
}

function getInitialOpenGroup(currentPage: string) {
  const parent = PARENT_OF[currentPage];
  if (parent) return parent;
  try {
    return localStorage.getItem('sk_sidebar_open_group') || '';
  } catch {
    return '';
  }
}

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
  const showExpandedContent = !isCollapsed || isOpen;
  const desktopWidthClass = isCollapsed ? 'lg:w-20' : 'lg:w-64';
  const [openGroup, setOpenGroup] = useState<string>(() => getInitialOpenGroup(currentPage));
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const visibleNav = useMemo(() => {
    if (!profile || profile.role === 'super_admin') return [] as Array<MenuLeaf | MenuGroup>;
    return NAV
      .filter((entry) => entry.roles.includes(role) && (isGroup(entry) || canAccessAccountPage(profile.role, entry.id, accountProfile, moduleSettings, userPermissions)))
      .map((entry) => {
        if (!isGroup(entry)) {
          return { ...entry, label: getAccountPageLabel(entry.id, accountProfile) ?? entry.label };
        }
        const groupCopy = getAccountGroupCopy(entry.id, accountProfile);
        const items = entry.items
          .filter((item) => item.roles.includes(role) && canAccessAccountPage(profile.role, item.id, accountProfile, moduleSettings, userPermissions))
          .map((item) => ({
            ...item,
            label: getAccountPageLabel(item.id, accountProfile) ?? item.label,
          }));
        return {
          ...entry,
          label: groupCopy?.label ?? entry.label,
          description: groupCopy?.description ?? entry.description,
          items,
        };
      })
      .filter((entry) => !isGroup(entry) || entry.items.length > 0);
  }, [accountProfile, moduleSettings, profile, role, userPermissions]);

  useEffect(() => {
    const parent = PARENT_OF[currentPage];
    if (!parent) return;
    setOpenGroup(parent);
    try {
      localStorage.setItem('sk_sidebar_open_group', parent);
    } catch {
      /* noop */
    }
  }, [currentPage]);

  const handleNavigate = (page: string) => {
    onNavigate(page);
    onClose?.();
    setUserMenuOpen(false);
  };

  const toggleGroup = (id: string) => {
    if (isCollapsed && !isOpen && onToggleCollapsed) {
      onToggleCollapsed();
    }
    setOpenGroup((current) => {
      const next = current === id ? '' : id;
      try {
        if (next) localStorage.setItem('sk_sidebar_open_group', next);
        else localStorage.removeItem('sk_sidebar_open_group');
      } catch {
        /* noop */
      }
      return next;
    });
  };

  const isLeafActive = (id: string) => {
    if (currentPage === id) return true;
    if (id === 'patrimoine') return currentPage === 'immeubles' || currentPage === 'unites';
    return id === 'tableau-de-bord-financier' && currentPage === 'filtres-avances';
  };

  const isGroupActive = (group: MenuGroup) => group.items.some((item) => isLeafActive(item.id));
  const initials = `${profile?.prenom?.[0] ?? 'A'}${profile?.nom?.[0] ?? 'S'}`;

  return (
    <>
      {isOpen && onClose && (
        <div className="fixed inset-0 z-40 bg-brand-950/60 backdrop-blur-sm animate-fadeIn lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 flex-col overflow-hidden border-r border-emerald-300/10 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.16),transparent_18rem),linear-gradient(180deg,#031f1a,#062b23_48%,#041b17)] text-white shadow-[18px_0_60px_rgba(2,6,23,0.24)]
          transform transition-[transform,width] duration-300 ease-in-out lg:static ${desktopWidthClass}
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className={`relative flex items-center overflow-hidden border-b border-white/10 px-4 py-5 ${showExpandedContent ? 'justify-between' : 'justify-center'}`}>
          <div className="absolute -left-8 top-0 h-28 w-28 rounded-full bg-emerald-300/15 blur-2xl" />
          <div className="absolute right-0 top-0 h-px w-2/3 bg-gradient-to-r from-transparent via-orange-300/60 to-transparent" />
          <div className="relative flex min-w-0 items-center gap-3">
            <BrandMark size="md" tone="dark" animated withTile={false} />
            <div className={`min-w-0 ${showExpandedContent ? '' : 'lg:hidden'}`}>
              <p className="truncate text-sm font-black tracking-widest text-brand-paper">SAMAY KEUR</p>
              <p className="mt-1 truncate text-xs font-black uppercase tracking-widest text-action-500">Manage. Grow. Prosper.</p>
            </div>
          </div>

          <div className={`relative flex items-center gap-1 ${showExpandedContent ? '' : 'lg:hidden'}`}>
            {onToggleCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="hidden rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:inline-flex"
                aria-label={isCollapsed ? 'Deployer la barre laterale' : 'Masquer la barre laterale'}
                title={isCollapsed ? 'Deployer' : 'Masquer'}
              >
                {isCollapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
              </button>
            )}
            {onClose && (
              <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Fermer le menu">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 xl:py-4">
          <ul className="space-y-1.5 px-3">
            {visibleNav.map((entry) => {
              if (!isGroup(entry)) {
                const Icon = entry.icon;
                const active = isLeafActive(entry.id);
                return (
                  <li key={entry.id}>
                    <button
                      onClick={() => handleNavigate(entry.id)}
                      title={entry.label}
                      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 xl:px-4 xl:py-3 ${active ? 'bg-white/[0.09] text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_30px_rgba(0,0,0,0.16)] ring-1 ring-emerald-300/10' : 'text-slate-400 hover:bg-white/[0.055] hover:text-white'
                        } ${showExpandedContent ? '' : 'justify-center px-0'}`}
                    >
                      {active && <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r bg-emerald-300" />}
                      <Icon className={`h-5 w-5 flex-shrink-0 ${active ? 'text-emerald-300' : 'text-slate-500 group-hover:text-emerald-200'}`} />
                      <span className={`text-sm font-bold ${showExpandedContent ? '' : 'lg:hidden'}`}>{entry.label}</span>
                      {active && <ChevronRight className={`ml-auto h-4 w-4 text-emerald-300 ${showExpandedContent ? '' : 'lg:hidden'}`} />}
                    </button>
                  </li>
                );
              }

              const Icon = entry.icon;
              const active = isGroupActive(entry);
              const open = openGroup === entry.id;

              return (
                <li key={entry.id}>
                  <button
                    onClick={() => toggleGroup(entry.id)}
                    title={entry.label}
                    className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 xl:px-4 xl:py-3 ${active ? 'bg-white/[0.09] text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_30px_rgba(0,0,0,0.16)] ring-1 ring-emerald-300/10' : 'text-slate-400 hover:bg-white/[0.055] hover:text-white'
                      } ${showExpandedContent ? '' : 'justify-center px-0'}`}
                  >
                    {active && <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r bg-emerald-300" />}
                    <Icon className={`h-5 w-5 flex-shrink-0 ${active ? 'text-emerald-300' : 'text-slate-500 group-hover:text-emerald-200'}`} />
                    <span className={`flex-1 text-left ${showExpandedContent ? '' : 'lg:hidden'}`}>
                      <span className="block text-sm font-bold">{entry.label}</span>
                      <span className={`mt-0.5 block text-[11px] font-semibold leading-4 xl:mt-1 xl:text-xs ${active ? 'text-emerald-200/80' : 'text-slate-500'}`}>
                        {entry.description}
                      </span>
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showExpandedContent ? '' : 'lg:hidden'} ${open ? 'rotate-0' : '-rotate-90'} ${active ? 'text-emerald-300' : 'text-slate-500'}`} />
                  </button>

                  {open && showExpandedContent && (
                    <ul className="ml-4 mt-1.5 space-y-1 rounded-2xl border border-white/5 bg-black/10 p-1.5 shadow-inner">
                      {entry.items.map((leaf) => {
                        const LeafIcon = leaf.icon;
                        const leafActive = isLeafActive(leaf.id);
                        return (
                          <li key={leaf.id}>
                            <button
                              onClick={() => handleNavigate(leaf.id)}
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-all duration-200 ${leafActive ? 'bg-emerald-300/14 text-emerald-50 ring-1 ring-emerald-300/10' : 'text-slate-500 hover:bg-white/[0.055] hover:text-slate-200'
                                }`}
                            >
                              <LeafIcon className={`h-4 w-4 flex-shrink-0 ${leafActive ? 'text-emerald-300' : 'text-slate-600'}`} />
                              <span className="text-sm font-semibold">{leaf.label}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="relative border-t border-white/10 bg-black/10 p-4">
          <button
            type="button"
            onClick={() => setUserMenuOpen((value) => !value)}
            className={`w-full rounded-2xl border border-white/10 bg-white/[0.065] px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:bg-white/[0.095] ${showExpandedContent ? '' : 'lg:flex lg:justify-center lg:px-0'}`}
            aria-expanded={userMenuOpen}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-300 to-brand-700 text-sm font-black text-white shadow-lg shadow-emerald-900/20">
                {initials}
              </div>
              <div className={`min-w-0 flex-1 ${showExpandedContent ? '' : 'lg:hidden'}`}>
                <p className="truncate text-sm font-black text-white">
                  {profile?.prenom} {profile?.nom}
                </p>
                <p className="text-xs font-bold capitalize text-emerald-200">{profile?.role}</p>
              </div>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition ${userMenuOpen ? 'rotate-180' : ''} ${showExpandedContent ? '' : 'lg:hidden'}`} />
            </div>
          </button>

          {userMenuOpen && showExpandedContent && (
            <div className="absolute bottom-[5.6rem] left-4 right-4 z-20 overflow-hidden rounded-2xl border border-white/10 bg-brand-900/98 p-2 shadow-2xl shadow-black/30 backdrop-blur">
              <button type="button" onClick={() => handleNavigate('parametres')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-200 hover:bg-white/10">
                <Settings className="h-4 w-4 text-emerald-200" />
                Parametres
              </button>
              <div className="rounded-xl px-1 py-1">
                <NotificationBell onNavigate={handleNavigate} compact align="bottom" />
              </div>
              <button type="button" onClick={() => handleNavigate('notifications')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-200 hover:bg-white/10">
                <UserCircle className="h-4 w-4 text-emerald-200" />
                Notifications
              </button>
              <button type="button" onClick={() => handleNavigate('parametres')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-200 hover:bg-white/10">
                <HelpCircle className="h-4 w-4 text-emerald-200" />
                Aide / support
              </button>
              <button type="button" onClick={() => void signOut()} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-orange-200 hover:bg-orange-500/10">
                <LogOut className="h-4 w-4" />
                Deconnexion
              </button>
            </div>
          )}

          {!showExpandedContent && (
            <button
              onClick={() => void signOut()}
              className="mt-3 hidden w-full items-center justify-center rounded-lg px-4 py-3 text-slate-400 transition hover:bg-white/[0.055] hover:text-white lg:flex"
              title="Deconnexion"
            >
              <LogOut className="h-5 w-5" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
