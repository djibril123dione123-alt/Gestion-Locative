import { useState, useMemo, useEffect, ComponentType } from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  CreditCard,
  Calculator,
  LogOut,
  UserCircle,
  DoorOpen,
  ChevronRight,
  ChevronDown,
  X,
  Settings,
  Wrench,
  CalendarDays,
  FolderOpen,
  ClipboardList,
  TrendingDown,
  Wallet,
  Briefcase,
  HardHat,
  AlertCircle,
  BarChart3,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from '../ui/NotificationBell';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

type Role = 'admin' | 'agent' | 'comptable' | 'bailleur';

interface MenuLeaf {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  roles: Role[];
}

interface MenuGroup {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  roles: Role[];
  items: MenuLeaf[];
}

// =============================================================
// IA repensée comme un gestionnaire d'agence (avril 2026)
// =============================================================
//   ➜ Tableau de bord                 [accès direct]
//   ➜ Finances ▾                      [usage quotidien intensif]
//        Encaissements (Reçus | Impayés)
//        Dépenses
//        Commissions
//        Analyses (Rapports | Filtres)
//   ➜ Locations ▾                     [usage quotidien]
//        Locataires, Contrats
//   ➜ Patrimoine ▾                    [usage hebdomadaire]
//        Bailleurs, Immeubles, Produits
//   ➜ Activité ▾                      [usage opérationnel]
//        Calendrier, Maintenance, États des lieux, Documents
//   ➜ Paramètres ▾                    [rare — config]
//        Mon agence | Équipe | Abonnement (onglets internes au sein de la page)
// =============================================================

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
      //{ id: 'commissions', label: 'Commissions', icon: Calculator, roles: ['admin'] },
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
    // Pour Paramètres : aucune sous-entrée car la page utilise des onglets
    // internes (Mon agence | Équipe | Abonnement). On expose un seul lien
    // clickable qui mène à la page tabbed.
    items: [],
  },
];

// Map enfant → groupe (pour auto-expand quand on est sur une sous-page)
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

export function Sidebar({ currentPage, onNavigate, isOpen = true, onClose }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const role = (profile?.role ?? 'agent') as Role;

  const visibleNav = useMemo(() => {
    if (!profile || profile.role === 'super_admin') return [] as Array<MenuLeaf | MenuGroup>;
    return NAV
      .filter((entry) => entry.roles.includes(role))
      .map((entry) => {
        if (isGroup(entry)) {
          const items = entry.items.filter((it) => it.roles.includes(role));
          return { ...entry, items };
        }
        return entry;
      })
      .filter((entry) => !isGroup(entry) || entry.items.length > 0 || entry.id === 'parametres');
  }, [profile, role]);

  // Auto-expand le groupe contenant la page courante
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

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNavigate = (page: string) => {
    onNavigate(page);
    if (onClose) onClose();
  };

  const isLeafActive = (id: string) => {
    if (currentPage === id) return true;
    // 'paiements' active aussi quand on est sur 'loyers-impayes' (même page Encaissements)
    if (id === 'paiements' && currentPage === 'loyers-impayes') return true;
    if (id === 'tableau-de-bord-financier' && currentPage === 'filtres-avances') return true;
    if (id === 'parametres' && (currentPage === 'equipe' || currentPage === 'abonnement')) return true;
    return false;
  };

  const isGroupActive = (group: MenuGroup) =>
    group.items.some((it) => isLeafActive(it.id)) ||
    (group.id === 'parametres' && isLeafActive('parametres'));

  return (
    <>
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden animate-fadeIn"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 h-screen flex flex-col text-white
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ backgroundColor: '#2D2D2D' }}
      >
        {/* Logo */}
        <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: '#3A3A3A' }}>
          <img
            src="/logo-full.png"
            alt="Samay Këur"
            className="w-48 h-auto object-contain mx-auto"
          />
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden absolute right-3 top-3 p-2 rounded-lg hover:bg-slate-700 transition-colors"
              aria-label="Fermer le menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
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
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative"
                      style={{
                        backgroundColor: active ? 'rgba(245, 130, 32, 0.15)' : 'transparent',
                        color: active ? '#FFA64D' : '#B0B0B0',
                      }}
                    >
                      {active && (
                        <div
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r"
                          style={{ backgroundColor: '#F58220' }}
                        />
                      )}
                      <Icon className="w-5 h-5" style={{ color: active ? '#F58220' : '#707070' }} />
                      <span className="font-medium text-sm">{entry.label}</span>
                      {active && <ChevronRight className="w-4 h-4 ml-auto" style={{ color: '#F58220' }} />}
                    </button>
                  </li>
                );
              }

              const Icon = entry.icon;
              const active = isGroupActive(entry);
              const open = openGroups.has(entry.id);
              const isParametres = entry.id === 'parametres';

              return (
                <li key={entry.id}>
                  <button
                    onClick={() => {
                      // Paramètres : pas de sous-entrées, on navigue direct
                      if (isParametres) {
                        handleNavigate('parametres');
                        return;
                      }
                      toggleGroup(entry.id);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative"
                    style={{
                      backgroundColor: active ? 'rgba(245, 130, 32, 0.10)' : 'transparent',
                      color: active ? '#FFA64D' : '#B0B0B0',
                    }}
                  >
                    {active && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r"
                        style={{ backgroundColor: '#F58220' }}
                      />
                    )}
                    <Icon className="w-5 h-5" style={{ color: active ? '#F58220' : '#707070' }} />
                    <span className="font-medium text-sm flex-1 text-left">{entry.label}</span>
                    {!isParametres && (
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
                        style={{ color: active ? '#F58220' : '#707070' }}
                      />
                    )}
                  </button>

                  {!isParametres && open && (
                    <ul className="mt-1 ml-3 pl-3 border-l space-y-0.5" style={{ borderColor: '#3A3A3A' }}>
                      {entry.items.map((leaf) => {
                        const LeafIcon = leaf.icon;
                        const leafActive = isLeafActive(leaf.id);
                        return (
                          <li key={leaf.id}>
                            <button
                              onClick={() => handleNavigate(leaf.id)}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-left"
                              style={{
                                backgroundColor: leafActive ? 'rgba(245, 130, 32, 0.18)' : 'transparent',
                                color: leafActive ? '#FFA64D' : '#9A9A9A',
                              }}
                            >
                              <LeafIcon
                                className="w-4 h-4 flex-shrink-0"
                                style={{ color: leafActive ? '#F58220' : '#707070' }}
                              />
                              <span className="text-sm font-medium">{leaf.label}</span>
                              {leaf.id === 'paiements' && (
                                <AlertCircle
                                  className="w-3.5 h-3.5 ml-auto opacity-0"
                                  aria-hidden="true"
                                />
                              )}
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

          <div className="px-3 mt-2">
            <NotificationBell onNavigate={handleNavigate} />
          </div>
        </nav>

        {/* Profil */}
        <div className="p-4 border-t" style={{ borderColor: '#3A3A3A' }}>
          <div className="mb-3 px-3 py-3 rounded-lg" style={{ backgroundColor: '#3A3A3A' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ background: 'linear-gradient(135deg, #F58220 0%, #C0392B 100%)' }}
              >
                {profile?.prenom?.[0] ?? 'A'}
                {profile?.nom?.[0] ?? 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {profile?.prenom} {profile?.nom}
                </p>
                <p className="text-xs capitalize" style={{ color: '#FFA64D' }}>
                  {profile?.role}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition hover:bg-slate-700"
            style={{ backgroundColor: 'transparent', color: '#B0B0B0' }}
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Déconnexion</span>
          </button>
        </div>
      </div>
    </>
  );
}
