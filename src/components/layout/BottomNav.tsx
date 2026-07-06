import { CreditCard, FileText, FolderOpen, LayoutDashboard, MoreHorizontal } from 'lucide-react';
import { canAccessAccountPage, type AccountProfile } from '../../lib/accountProfile';
import { canAccessPage, type UserPermissionMap } from '../../lib/rbac';
import type { UserRole } from '../../lib/supabase';
import type { AgencySettings } from '../../types/agency';

interface BottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onOpenMenu: () => void;
  role?: UserRole | null;
  accountProfile?: AccountProfile;
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

const AGENCY_BOTTOM_ITEMS = [
  { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
  { id: 'paiements', label: 'Loyers', icon: CreditCard },
  { id: 'occupants-baux', label: 'Locations', icon: FileText },
  { id: 'documents', label: 'Docs', icon: FolderOpen },
];

const INDIVIDUAL_OWNER_BOTTOM_ITEMS = [
  { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
  { id: 'paiements', label: 'Loyers', icon: CreditCard },
  { id: 'patrimoine', label: 'Biens', icon: FolderOpen },
  { id: 'documents', label: 'Docs', icon: FileText },
];

export function BottomNav({ currentPage, onNavigate, onOpenMenu, role = 'agent', accountProfile, moduleSettings, userPermissions }: BottomNavProps) {
  const isActive = (id: string) => currentPage === id;
  const canAccess = (id: string) => accountProfile
    ? canAccessAccountPage(role, id, accountProfile, moduleSettings, userPermissions)
    : canAccessPage(role, id, moduleSettings, userPermissions);
  const items = accountProfile?.isIndividualOwner ? INDIVIDUAL_OWNER_BOTTOM_ITEMS : AGENCY_BOTTOM_ITEMS;

  return (
    <nav
      className="sk-bottom-nav fixed bottom-0 left-0 right-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.3rem)] lg:hidden"
      aria-label="Navigation mobile principale"
    >
      <div className="sk-bottom-nav-inner mx-auto flex max-w-[21.5rem] items-center gap-1 rounded-[2rem] border border-white/65 bg-[#fffdf8]/75 px-1.5 py-1 shadow-[0_18px_45px_rgba(15,23,42,0.18)] ring-1 ring-emerald-950/5 backdrop-blur-2xl backdrop-saturate-150">
        {items.filter(({ id }) => canAccess(id)).map(({ id, label, icon: Icon }) => {
          const active = isActive(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`sk-pressable group relative flex min-h-[2.75rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1 transition-all duration-300 ${
                active
                  ? 'bg-brand-950 text-white shadow-premium'
                  : 'text-slate-500 hover:bg-white/70 hover:text-brand-900'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={`h-[1.08rem] w-[1.08rem] transition-transform duration-300 ${active ? 'scale-105 text-orange-200 group-active:scale-95' : 'group-hover:-translate-y-0.5'}`} />
              <span className="text-center text-[0.64rem] font-black leading-tight">{label}</span>
              {active && <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-action-500 ring-4 ring-action-500/15" />}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          className="sk-pressable group relative flex min-h-[2.75rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1 text-slate-500 transition-all duration-300 hover:bg-white/70 hover:text-brand-900"
          aria-label="Ouvrir plus de navigation"
        >
          <MoreHorizontal className="h-[1.08rem] w-[1.08rem] transition-transform duration-300 group-hover:-translate-y-0.5" />
          <span className="text-[0.64rem] font-black leading-tight">Plus</span>
        </button>
      </div>
    </nav>
  );
}
