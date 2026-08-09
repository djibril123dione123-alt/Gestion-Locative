import {
  ChevronsLeft,
  ChevronsRight,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { BrandMark } from '../brand/BrandLogo';

export interface AppSidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  section?: string;
}

interface AppSidebarFrameProps {
  items: AppSidebarItem[];
  activeItem: string;
  onNavigate: (item: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
  footer?: (expanded: boolean) => ReactNode;
  isItemActive?: (item: string) => boolean;
}

export function AppSidebarFrame({
  items,
  activeItem,
  onNavigate,
  isOpen = true,
  onClose,
  isCollapsed = false,
  onToggleCollapsed,
  footer,
  isItemActive,
}: AppSidebarFrameProps) {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  }, []);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => setIsHovered(false), 180);
  };

  const expandedByHover = Boolean(isCollapsed && isHovered);
  const expanded = !isCollapsed || isOpen || expandedByHover;
  const widthClass = expanded ? 'w-56 lg:w-56' : 'w-56 lg:w-[3.75rem]';
  const positionClass = isCollapsed
    ? 'lg:fixed lg:inset-y-0 lg:left-0 lg:z-50'
    : 'lg:static';

  return (
    <>
      {isCollapsed && !isOpen && (
        <div
          className="fixed inset-y-0 left-0 z-40 hidden w-3.5 lg:block"
          onMouseEnter={handleMouseEnter}
        />
      )}

      {isOpen && onClose && (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-40 bg-brand-950/60 backdrop-blur-sm animate-fadeIn lg:hidden"
          onClick={onClose}
        />
      )}

      {isCollapsed && <div className="hidden lg:block lg:w-[3.75rem] lg:flex-shrink-0" />}

      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed inset-y-0 left-0 z-50 flex h-screen flex-col overflow-hidden border-r border-white/[0.03] bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.12),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(251,191,36,0.06),transparent_45%),linear-gradient(180deg,#041b15_0%,#06271f_45%,#02110d_100%)] text-white shadow-[20px_0_60px_rgba(0,0,0,0.4),inset_-1px_0_0_rgba(255,255,255,0.02)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${widthClass} ${positionClass} ${expandedByHover ? 'lg:shadow-[30px_0_80px_rgba(0,0,0,0.6)]' : ''} ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className={`relative z-10 flex items-center overflow-visible border-b border-white/[0.04] bg-black/20 backdrop-blur-md ${expanded ? 'justify-between pl-4 pr-2 py-4' : 'justify-center p-4'}`}>
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
          <div className="absolute -left-8 top-0 h-32 w-32 rounded-full bg-emerald-400/10 blur-[30px] pointer-events-none" />
          
          <div className="relative flex min-w-0 flex-1 items-center">
            {expanded ? (
              <img src="/samay-keur-logo-sidebar.svg" alt="Samay Këur" className="h-11 w-full object-contain object-left scale-[1.25] origin-left drop-shadow-md transition-transform duration-300" />
            ) : (
              <BrandMark size="md" tone="dark" animated withTile={false} />
            )}
          </div>

          <div className="relative flex shrink-0 items-center z-10">
            {onToggleCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                className={`hidden rounded-xl p-2 transition-all duration-200 lg:inline-flex ${isCollapsed ? 'bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
                aria-label={isCollapsed ? 'Épingler la barre latérale' : 'Rétracter la barre latérale'}
                title={isCollapsed ? 'Épingler la barre latérale' : 'Rétracter la barre latérale'}
              >
                {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        <nav className="relative flex-1 overflow-y-auto py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden xl:py-4">
          <div className="absolute left-4 top-0 h-full w-px bg-gradient-to-b from-white/[0.02] via-white/[0.05] to-transparent pointer-events-none hidden lg:block" />
          <ul className="relative space-y-1.5 px-3 z-10">
            {items.map((entry) => {
              const active = isItemActive?.(entry.id) ?? entry.id === activeItem;
              const Icon = entry.icon;
              return (
                <Fragment key={entry.id}>
                  {entry.section && expanded && (
                    <li className="px-3 pb-1.5 pt-5 first:pt-1">
                      <span className="block text-[0.6rem] font-black uppercase tracking-[0.22em] text-emerald-100/40">
                        {entry.section}
                      </span>
                    </li>
                  )}
                  <li>
                    <button
                      type="button"
                      onClick={() => onNavigate(entry.id)}
                      title={entry.label}
                      className={`group relative flex w-full items-center gap-3.5 rounded-xl px-3 py-2.5 transition-all duration-300 ease-out ${
                        active 
                          ? 'bg-gradient-to-r from-emerald-500/20 to-white/[0.06] font-bold text-white shadow-[0_4px_16px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/[0.05] border-l border-emerald-400/50' 
                          : 'font-semibold text-slate-400 hover:bg-white/[0.04] hover:text-slate-100 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] border-l border-transparent'
                      } ${expanded ? '' : 'justify-center px-0'}`}
                    >
                      {active && (
                        <span className="absolute -left-[1px] top-1/2 h-[60%] w-[3px] -translate-y-1/2 rounded-r-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                      )}
                      <Icon className={`h-[1.1rem] w-[1.1rem] flex-shrink-0 transition-all duration-300 ${
                        active 
                          ? 'text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)] scale-110' 
                          : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-110'
                      }`} />
                      {expanded && <span className="truncate text-[0.8rem] tracking-wide">{entry.label}</span>}
                    </button>
                  </li>
                </Fragment>
              );
            })}
          </ul>
        </nav>

        {footer && (
          <div className="relative z-10 border-t border-white/[0.04] bg-[#020b09]/60 backdrop-blur-md p-3 shadow-[0_-10px_20px_rgba(0,0,0,0.2)]">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
            {footer(expanded)}
          </div>
        )}
      </aside>
    </>
  );
}
