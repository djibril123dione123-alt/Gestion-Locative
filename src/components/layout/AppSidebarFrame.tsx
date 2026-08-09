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
        className={`fixed inset-y-0 left-0 z-50 flex h-screen flex-col overflow-hidden border-r border-emerald-300/10 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.18),transparent_18rem),linear-gradient(180deg,#031f1a,#062b23_48%,#041b17)] text-white shadow-[18px_0_60px_rgba(2,6,23,0.28)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${widthClass} ${positionClass} ${expandedByHover ? 'lg:shadow-[24px_0_60px_rgba(0,0,0,0.55)]' : ''} ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className={`relative flex items-center overflow-visible border-b border-white/10 ${expanded ? 'justify-between pl-4 pr-2 py-4' : 'justify-center p-4'}`}>
          <div className="absolute -left-8 top-0 h-28 w-28 rounded-full bg-emerald-300/15 blur-2xl" />
          <div className="absolute right-0 top-0 h-px w-2/3 bg-gradient-to-r from-transparent via-orange-300/60 to-transparent" />
          <div className="relative flex min-w-0 flex-1 items-center">
            {expanded ? (
              <img src="/samay-keur-logo-sidebar.svg" alt="Samay Këur" className="h-12 w-full object-contain object-left scale-[1.3] origin-left drop-shadow-sm" />
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

        <nav className="flex-1 overflow-y-auto py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden xl:py-3">
          <ul className="space-y-1 px-2.5">
            {items.map((entry) => {
              const active = isItemActive?.(entry.id) ?? entry.id === activeItem;
              const Icon = entry.icon;
              return (
                <Fragment key={entry.id}>
                  {entry.section && expanded && (
                    <li className="px-2.5 pb-1 pt-3.5 first:pt-1">
                      <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400/70">
                        {entry.section}
                      </span>
                    </li>
                  )}
                  <li>
                    <button
                      type="button"
                      onClick={() => onNavigate(entry.id)}
                      title={entry.label}
                      className={`group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 transition-all duration-200 ${active ? 'bg-gradient-to-r from-emerald-500/25 to-white/[0.05] font-extrabold text-white shadow-[0_4px_16px_rgba(0,0,0,0.25)] ring-1 ring-emerald-400/30' : 'font-semibold text-slate-300 hover:bg-white/[0.065] hover:text-white'} ${expanded ? '' : 'justify-center px-0'}`}
                    >
                      {active && (
                        <span className="absolute bottom-1.5 left-0 top-1.5 w-1 rounded-r-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]" />
                      )}
                      <Icon className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-emerald-300' : 'text-slate-400 group-hover:text-emerald-200'}`} />
                      {expanded && <span className="truncate text-xs tracking-wide">{entry.label}</span>}
                    </button>
                  </li>
                </Fragment>
              );
            })}
          </ul>
        </nav>

        {footer && (
          <div className="relative border-t border-white/10 bg-black/20 p-3">
            {footer(expanded)}
          </div>
        )}
      </aside>
    </>
  );
}
