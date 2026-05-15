import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  AlertCircle,
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  DoorOpen,
  FileText,
  FolderOpen,
  HardHat,
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
import { canAccessPage } from '../../lib/rbac';
import type { AgencySettings } from '../../types/agency';
import { BrandMark } from '../brand/BrandLogo';
import { NotificationBell } from '../ui/NotificationBell';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  moduleSettings?: Partial<
    Pick<
      AgencySettings,
      'module_depenses_actif' | 'module_inventaires_actif' | 'module_interventions_actif' | 'mode_avance_actif'
    >
  > | null;
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
  icon: ComponentType<{ className?: string }>;
  roles: Role[];
  items: MenuLeaf[];
}

const NAV: Array<MenuLeaf | MenuGroup> = [
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    icon: LayoutDashboard,
    roles: ['admin', 'agent', 'comptable', 'bailleur'],
  },
  {
    id: 'finances',
    label: 'Finances',
    icon: Wallet,
    roles: ['admin', 'agent', 'comptable', 'bailleur'],
    items: [
      { id: 'paiements', label: 'Encaissements', icon: CreditCard, roles: ['admin', 'agent', 'comptable', 'bailleur'] },
      { id: 'depenses', label: 'Dépenses', icon: TrendingDown, roles: ['admin'] },
      { id: 'tableau-de-bord-financier', label: 'Analyses', icon: BarChart3, roles: ['admin'] },
    ],
  },
  {
    id: 'locations',
    label: 'Locations',
    icon: Briefcase,
    roles: ['admin', 'agent', 'comptable', 'bailleur'],
    items: [
      { id: 'locataires', label: 'Locataires', icon: Users, roles: ['admin', 'agent', 'comptable'] },
      { id: 'contrats', label: 'Contrats', icon: FileText, roles: ['admin', 'agent', 'comptable', 'bailleur'] },
    ],
  },
  {
    id: 'patrimoine',
    label: 'Patrimoine',
    icon: Building2,
    roles: ['admin'],
    items: [
      { id: 'bailleurs', label: 'Bailleurs', icon: UserCircle, roles: ['admin'] },
      { id: 'immeubles', label: 'Immeubles', icon: Building2, roles: ['admin'] },
      { id: 'unites', label: 'Produits', icon: DoorOpen, roles: ['admin'] },
    ],
  },
  {
    id: 'activite',
    label: 'Activité',
    icon: HardHat,
    roles: ['admin', 'agent'],
    items: [
      { id: 'calendrier', label: 'Calendrier', icon: CalendarDays, roles: ['admin', 'agent'] },
      { id: 'interventions', label: 'Maintenance', icon: Wrench, roles: ['admin', 'agent'] },
      { id: 'inventaires', label: 'États des lieux', icon: ClipboardList, roles: ['admin', 'agent'] },
      { id: 'documents', label: 'Documents', icon: FolderOpen, roles: ['admin', 'agent'] },
    ],
  },
  {
    id: 'parametres',
    label: 'Paramètres',
    icon: Settings,
    roles: ['admin'],
    items: [],
  },
];

const PARENT_OF: Record<string, string> = {
  paiements: 'finances',
  'loyers-impayes': 'finances',
  depenses: 'finances',
  commissions: 'finances',
  'tableau-de-bord-financier': 'finances',
  'filtres-avances': 'finances',
  locataires: 'locations',
  contrats: 'locations',
  bailleurs: 'patrimoine',
  immeubles: 'patrimoine',
  unites: 'patrimoine',
  calendrier: 'activite',
  interventions: 'activite',
  inventaires: 'activite',
  documents: 'activite',
  equipe: 'parametres',
  abonnement: 'parametres',
};

function isGroup(entry: MenuLeaf | MenuGroup): entry is MenuGroup {
  return 'items' in entry;
}

export function Sidebar({ currentPage, onNavigate, isOpen = true, onClose, moduleSettings }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const role = (profile?.role ?? 'agent') as Role;

  const visibleNav = useMemo(() => {
    if (!profile || profile.role === 'super_admin') return [] as Array<MenuLeaf | MenuGroup>;
    return NAV
      .filter((entry) => entry.roles.includes(role) && canAccessPage(profile.role, entry.id, moduleSettings))
      .map((entry) => {
        if (isGroup(entry)) {
          const items = entry.items.filter(
            (item) => item.roles.includes(role) && canAccessPage(profile.role, item.id, moduleSettings)
          );
          return { ...entry, items };
        }
        return entry;
      })
      .filter((entry) => !isGroup(entry) || entry.items.length > 0 || entry.id === 'parametres');
  }, [moduleSettings, profile, role]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    const parent = PARENT_OF[currentPage];
    if (parent) initial.add(parent);
    return initial;
  });

  useEffect(() => {
    const parent = PARENT_OF[currentPage];
    if (parent) {
      setOpenGroups((prev) => {
        if (prev.has(parent)) return prev;
        const next = new Set(prev);
        next.add(parent);
        return next;
      });
    }
  }, [currentPage]);

  const handleNavigate = (page: string) => {
    onNavigate(page);
    onClose?.();
  };

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isLeafActive = (id: string) => {
    if (currentPage === id) return true;
    if (id === 'paiements' && currentPage === 'loyers-impayes') return true;
    if (id === 'tableau-de-bord-financier' && currentPage === 'filtres-avances') return true;
    if (id === 'parametres' && (currentPage === 'equipe' || currentPage === 'abonnement')) return true;
    return false;
  };

  const isGroupActive = (group: MenuGroup) =>
    group.items.some((item) => isLeafActive(item.id)) ||
    (group.id === 'parametres' && isLeafActive('parametres'));

  return (
    <>
      {isOpen && onClose && (
        <div className="fixed inset-0 z-40 bg-brand-950/60 backdrop-blur-sm animate-fadeIn lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex h-screen w-72 flex-col border-r border-white/10 bg-brand-950 text-white shadow-[24px_0_80px_rgba(6,17,13,0.18)]
          transform transition-transform duration-300 ease-in-out lg:static
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="relative flex items-center justify-between overflow-hidden border-b border-white/10 p-4">
          <div className="absolute -left-8 top-0 h-24 w-24 rounded-full bg-emerald-300/12 blur-2xl" />
          <div className="relative flex min-w-0 items-center gap-3">
            <BrandMark size="md" tone="dark" animated withTile={false} />
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-[0.22em] text-brand-paper">SAMAY KËUR</p>
              <p className="mt-0.5 truncate text-[0.56rem] font-black uppercase tracking-[0.24em] text-action-500">
                Manage. Grow. Prosper.
              </p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Fermer le menu">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {visibleNav.map((entry) => {
              if (!isGroup(entry)) {
                const Icon = entry.icon;
                const active = isLeafActive(entry.id);
                return (
                  <li key={entry.id}>
                    <button
                      onClick={() => handleNavigate(entry.id)}
                      className={`group relative flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200 ${
                        active ? 'bg-emerald-300/12 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]' : 'text-slate-400 hover:bg-white/[0.055] hover:text-white'
                      }`}
                    >
                      {active && <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r bg-emerald-300" />}
                      <Icon className={`h-5 w-5 ${active ? 'text-emerald-300' : 'text-slate-500 group-hover:text-emerald-200'}`} />
                      <span className="text-sm font-bold">{entry.label}</span>
                      {active && <ChevronRight className="ml-auto h-4 w-4 text-emerald-300" />}
                    </button>
                  </li>
                );
              }

              const Icon = entry.icon;
              const active = isGroupActive(entry);
              const open = openGroups.has(entry.id);
              const isSettings = entry.id === 'parametres';

              return (
                <li key={entry.id}>
                  <button
                    onClick={() => {
                      if (isSettings) {
                        handleNavigate('parametres');
                        return;
                      }
                      toggleGroup(entry.id);
                    }}
                    className={`group relative flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200 ${
                      active ? 'bg-emerald-300/10 text-emerald-100' : 'text-slate-400 hover:bg-white/[0.055] hover:text-white'
                    }`}
                  >
                    {active && <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r bg-emerald-300" />}
                    <Icon className={`h-5 w-5 ${active ? 'text-emerald-300' : 'text-slate-500 group-hover:text-emerald-200'}`} />
                    <span className="flex-1 text-left text-sm font-bold">{entry.label}</span>
                    {!isSettings && (
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'} ${active ? 'text-emerald-300' : 'text-slate-500'}`} />
                    )}
                  </button>

                  {!isSettings && open && (
                    <ul className="ml-3 mt-1 space-y-0.5 border-l border-white/10 pl-3">
                      {entry.items.map((leaf) => {
                        const LeafIcon = leaf.icon;
                        const leafActive = isLeafActive(leaf.id);
                        return (
                          <li key={leaf.id}>
                            <button
                              onClick={() => handleNavigate(leaf.id)}
                              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all duration-200 ${
                                leafActive ? 'bg-emerald-300/12 text-emerald-100' : 'text-slate-500 hover:bg-white/[0.055] hover:text-slate-200'
                              }`}
                            >
                              <LeafIcon className={`h-4 w-4 flex-shrink-0 ${leafActive ? 'text-emerald-300' : 'text-slate-600'}`} />
                              <span className="text-sm font-semibold">{leaf.label}</span>
                              {leaf.id === 'paiements' && <AlertCircle className="ml-auto h-3.5 w-3.5 opacity-0" aria-hidden="true" />}
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

          <div className="px-3 pt-3">
            <NotificationBell onNavigate={handleNavigate} />
          </div>
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.055] px-3 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-300 to-brand-700 text-sm font-black text-white">
                {profile?.prenom?.[0] ?? 'A'}
                {profile?.nom?.[0] ?? 'S'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">
                  {profile?.prenom} {profile?.nom}
                </p>
                <p className="text-xs font-bold capitalize text-emerald-200">{profile?.role}</p>
              </div>
            </div>
          </div>

          <button onClick={() => signOut()} className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-slate-400 transition hover:bg-white/[0.055] hover:text-white">
            <LogOut className="h-5 w-5" />
            <span className="text-sm font-bold">Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  );
}
