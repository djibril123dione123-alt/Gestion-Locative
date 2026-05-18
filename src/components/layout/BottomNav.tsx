import { CreditCard, FolderOpen, LayoutDashboard, MoreHorizontal, ReceiptText } from 'lucide-react';
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
  { id: 'loyers-impayes', label: 'Impayés', icon: ReceiptText },
  { id: 'documents', label: 'Docs', icon: FolderOpen },
];

export function BottomNav({ currentPage, onNavigate, onOpenMenu, role = 'agent', moduleSettings, userPermissions }: BottomNavProps) {
  const isActive = (id: string) => currentPage === id;

  return (
    <nav
      className="sk-bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t border-emerald-900/10 bg-white/[0.88] shadow-[0_-18px_54px_rgba(6,17,13,0.14)] backdrop-blur-2xl lg:hidden"
      aria-label="Navigation mobile principale"
    >
      <div className="sk-bottom-nav-inner mx-auto flex max-w-md items-stretch px-2 pt-2">
        {BOTTOM_ITEMS.filter(({ id }) => canAccessPage(role, id, moduleSettings, userPermissions)).map(({ id, label, icon: Icon }) => {
          const active = isActive(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`sk-pressable relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl transition ${
                active
                  ? 'bg-brand-950 text-white shadow-[0_12px_30px_rgba(6,17,13,0.20)]'
                  : 'text-slate-500 hover:bg-emerald-50 hover:text-brand-800'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={`h-[19px] w-[19px] ${active ? 'text-orange-200' : ''}`} />
              <span className="max-w-full truncate px-1 text-[10.5px] font-black leading-none">{label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          className="sk-pressable relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-slate-500 transition hover:bg-emerald-50 hover:text-brand-800"
          aria-label="Ouvrir plus de navigation"
        >
          <MoreHorizontal className="h-[19px] w-[19px]" />
          <span className="text-[10.5px] font-black leading-none">Plus</span>
        </button>
      </div>
    </nav>
  );
}
