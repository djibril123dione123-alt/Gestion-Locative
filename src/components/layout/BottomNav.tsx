import { LayoutDashboard, CreditCard, FileText, Wrench, MoreHorizontal } from 'lucide-react';
import { canAccessPage } from '../../lib/rbac';
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
}

const BOTTOM_ITEMS = [
  { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
  { id: 'paiements', label: 'Encaiss.', icon: CreditCard },
  { id: 'contrats', label: 'Contrats', icon: FileText },
  { id: 'interventions', label: 'Maintenance', icon: Wrench },
];

export function BottomNav({ currentPage, onNavigate, onOpenMenu, role = 'agent', moduleSettings }: BottomNavProps) {
  const isActive = (id: string) => {
    if (id === 'paiements' && (currentPage === 'paiements' || currentPage === 'loyers-impayes')) return true;
    return currentPage === id;
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-emerald-900/10 bg-white/94 shadow-[0_-18px_44px_rgba(6,17,13,0.10)] backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-14">
        {BOTTOM_ITEMS.filter(({ id }) => canAccessPage(role, id, moduleSettings)).map(({ id, label, icon: Icon }) => {
          const active = isActive(id);
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-brand-800' : 'text-slate-400 hover:text-brand-700'
              }`}
            >
              {active && (
                <div className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-b bg-brand-700" />
              )}
              <Icon className="w-[18px] h-[18px]" />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </button>
          );
        })}
        <button
          onClick={onOpenMenu}
          className="relative flex flex-1 flex-col items-center justify-center gap-0.5 text-slate-400 transition-colors hover:text-brand-700"
        >
          <MoreHorizontal className="w-[18px] h-[18px]" />
          <span className="text-[10px] font-medium leading-none">Plus</span>
        </button>
      </div>
    </nav>
  );
}
