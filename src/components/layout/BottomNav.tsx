import { LayoutDashboard, CreditCard, FileText, Wrench, MoreHorizontal } from 'lucide-react';

interface BottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onOpenMenu: () => void;
}

const BOTTOM_ITEMS = [
  { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
  { id: 'paiements', label: 'Encaiss.', icon: CreditCard },
  { id: 'contrats', label: 'Contrats', icon: FileText },
  { id: 'interventions', label: 'Maintenance', icon: Wrench },
];

export function BottomNav({ currentPage, onNavigate, onOpenMenu }: BottomNavProps) {
  const isActive = (id: string) => {
    if (id === 'paiements' && (currentPage === 'paiements' || currentPage === 'loyers-impayes')) return true;
    return currentPage === id;
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-14">
        {BOTTOM_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = isActive(id);
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="flex-1 relative flex flex-col items-center justify-center gap-0.5 transition-colors"
              style={{ color: active ? '#F58220' : '#94a3b8' }}
            >
              {active && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b"
                  style={{ backgroundColor: '#F58220' }}
                />
              )}
              <Icon className="w-[18px] h-[18px]" />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </button>
          );
        })}
        <button
          onClick={onOpenMenu}
          className="flex-1 relative flex flex-col items-center justify-center gap-0.5 transition-colors text-slate-400"
        >
          <MoreHorizontal className="w-[18px] h-[18px]" />
          <span className="text-[10px] font-medium leading-none">Plus</span>
        </button>
      </div>
    </nav>
  );
}
