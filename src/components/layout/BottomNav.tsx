import { CreditCard, FileText, FolderOpen, LayoutDashboard, MoreHorizontal } from 'lucide-react';
import { canAccessPage, type UserPermissionMap } from '../../lib/rbac';
import type { UserRole } from '../../lib/supabase';
import type { AgencySettings } from '../../types/agency';

interface BottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onOpenMenu: () => void;
  role?: UserRole | null;
  moduleSettings?: Partial<
    Pick<
      AgencySettings,
      'module_depenses_actif' | 'module_inventaires_actif' | 'module_interventions_actif' | 'mode_avance_actif'
    >
  > | null;
  userPermissions?: UserPermissionMap | null;
}

const BOTTOM_ITEMS = [
  { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
  { id: 'paiements', label: 'Encaisser', icon: CreditCard },
  { id: 'contrats', label: 'Contrats', icon: FileText },
  { id: 'documents', label: 'Docs', icon: FolderOpen },
];

export function BottomNav({ currentPage, onNavigate, onOpenMenu, role = 'agent', moduleSettings, userPermissions }: BottomNavProps) {
  const isActive = (id: string) => currentPage === id;

  return (
    <nav
      className="sk-bottom-nav fixed bottom-0 left-0 right-0 z-40 px-3 lg:hidden"
      aria-label="Navigation mobile principale"
    >
      <div className="sk-bottom-nav-inner mx-auto flex max-w-[24rem] items-center gap-1 rounded-[1.65rem] border border-white/65 bg-white/[0.68] px-1.5 py-1.5 shadow-[0_18px_55px_rgba(6,17,13,0.18)] ring-1 ring-emerald-950/5 backdrop-blur-2xl">
        {BOTTOM_ITEMS.filter(({ id }) => canAccessPage(role, id, moduleSettings, userPermissions)).map(({ id, label, icon: Icon }) => {
          const active = isActive(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`sk-pressable group relative flex min-h-[3.15rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[1.25rem] px-1.5 py-1.5 transition-all duration-300 ${
                active
                  ? 'bg-brand-950 text-white shadow-[0_10px_24px_rgba(6,17,13,0.22)]'
                  : 'text-slate-500 hover:bg-white/70 hover:text-brand-900'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={`h-[18px] w-[18px] transition-transform duration-300 ${active ? 'scale-105 text-orange-200 group-active:scale-95' : 'group-hover:-translate-y-0.5'}`} />
              <span className="max-w-full truncate px-1 text-[10px] font-black leading-none tracking-[-0.01em]">{label}</span>
              {active && <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-action-500 shadow-[0_0_0_3px_rgba(255,138,0,0.16)]" />}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          className="sk-pressable group relative flex min-h-[3.15rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[1.25rem] px-1.5 py-1.5 text-slate-500 transition-all duration-300 hover:bg-white/70 hover:text-brand-900"
          aria-label="Ouvrir plus de navigation"
        >
          <MoreHorizontal className="h-[18px] w-[18px] transition-transform duration-300 group-hover:-translate-y-0.5" />
          <span className="text-[10px] font-black leading-none tracking-[-0.01em]">Plus</span>
        </button>
      </div>
    </nav>
  );
}
