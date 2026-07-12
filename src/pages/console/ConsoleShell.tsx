import React from 'react';
import { ChevronsLeft, ChevronsRight, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { BrandMark } from '../../components/brand/BrandLogo';
import { PremiumButton } from '../../components/ui/PremiumButton';
import { PremiumPageHeader } from '../../components/ui/PremiumPageHeader';
import { PremiumToolbar } from '../../components/ui/PremiumToolbar';
import { SplitViewShell } from '../../components/ui/SplitViewShell';
import { CONSOLE_NAV_ITEMS, type ConsoleSpace } from '../../lib/admin/adminNavigation';
import { classNames, formatAdminDateTime } from '../../lib/admin/adminFormatters';

export function ConsoleShell({
  activeSpace,
  onSpaceChange,
  onRefresh,
  onSignOut,
  refreshing,
  lastLoadedAt,
  partialErrors,
  searchSlot,
  detailSlot,
  isDetailOpen,
  children,
}: {
  activeSpace: ConsoleSpace;
  onSpaceChange: (space: ConsoleSpace) => void;
  onRefresh: () => void;
  onSignOut: () => void;
  refreshing: boolean;
  lastLoadedAt?: string | null;
  partialErrors: string[];
  searchSlot?: React.ReactNode;
  detailSlot?: React.ReactNode;
  isDetailOpen?: boolean;
  children: React.ReactNode;
}) {
  const activeItem = CONSOLE_NAV_ITEMS.find((item) => item.id === activeSpace) ?? CONSOLE_NAV_ITEMS[0];
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isHoveringCollapsed, setIsHoveringCollapsed] = React.useState(false);
  const expandedSidebar = !isCollapsed || isHoveringCollapsed;
  void partialErrors;

  const sidebarWidth = expandedSidebar ? 'w-[15.5rem]' : 'w-[4rem]';

  return (
    <div className="h-screen overflow-hidden bg-[#f5efe3] text-slate-950">
      <div className="flex h-full min-h-0">
        {isCollapsed && <div className="hidden w-[4rem] shrink-0 xl:block" />}
        <aside
          className={classNames(
            'hidden h-screen shrink-0 flex-col border-r border-emerald-950/10 bg-emerald-950 text-white transition-[width] duration-300 ease-out xl:flex',
            sidebarWidth,
            isCollapsed ? 'fixed left-0 top-0 z-40 shadow-[20px_0_60px_rgba(0,0,0,0.22)]' : 'relative',
          )}
          onMouseEnter={() => setIsHoveringCollapsed(true)}
          onMouseLeave={() => setIsHoveringCollapsed(false)}
        >
          <div className="flex h-full min-h-0 flex-col p-3">
            <div className={classNames('rounded-2xl border border-white/10 bg-white/[0.055] shadow-[0_18px_50px_rgba(0,0,0,0.12)]', expandedSidebar ? 'p-3' : 'p-2')}>
              <div className="flex items-center gap-3">
                <BrandMark size="sm" tone="dark" animated withTile={false} className="shrink-0" />
                {expandedSidebar && (
                  <div className="min-w-0">
                    <p className="truncate text-[0.66rem] font-black uppercase tracking-[0.16em] text-emerald-100">Samay Këur</p>
                    <h1 className="truncate text-base font-black">Console admin</h1>
                  </div>
                )}
              </div>
              {expandedSidebar && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[0.68rem] font-black text-emerald-50">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Super-admin
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsCollapsed((value) => !value)}
              className={classNames(
                'mt-2 inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.055] text-emerald-50/75 transition hover:bg-white/10 hover:text-white',
                expandedSidebar ? 'self-end px-3' : 'w-full',
              )}
              aria-label={isCollapsed ? 'Déplier la console' : 'Réduire la console'}
            >
              {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>

            <nav className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
              {CONSOLE_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeSpace;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSpaceChange(item.id)}
                    className={classNames(
                      'group relative flex w-full items-center gap-2.5 rounded-xl border text-left font-black transition',
                      expandedSidebar ? 'px-3 py-2 text-[0.78rem]' : 'justify-center px-2 py-2.5',
                      active ? 'border-orange-300/35 bg-white text-emerald-950 shadow-md' : 'border-transparent text-emerald-50/75 hover:bg-white/10 hover:text-white',
                    )}
                    title={!expandedSidebar ? item.label : undefined}
                  >
                    {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-orange-400" />}
                    <Icon className="h-4 w-4 shrink-0" />
                    {expandedSidebar && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </nav>

            <div className={classNames('mt-3 shrink-0 rounded-2xl border border-white/10 bg-white/[0.055] text-xs font-semibold text-emerald-50/70', expandedSidebar ? 'p-3' : 'p-2 text-center')}>
              {expandedSidebar ? (
                <>
                  Dernier chargement<br />
                  <span className="font-black text-white">{lastLoadedAt ? formatAdminDateTime(lastLoadedAt) : 'En attente'}</span>
                </>
              ) : (
                <RefreshCw className="mx-auto h-4 w-4" />
              )}
            </div>
          </div>
        </aside>

        <main className="h-full min-w-0 flex-1 overflow-hidden">
          <div className="mx-auto h-full max-w-[1680px] px-2.5 py-2.5 sm:px-4">
            <SplitViewShell
              isDetailOpen={isDetailOpen}
              size="compact"
              desktopAt="lg"
              className="h-full min-h-0 items-stretch"
              mainClassName={classNames('h-full min-h-0', isDetailOpen && 'hidden lg:block')}
              detailClassName="h-full min-h-0"
              main={
                <div className="h-full min-h-0 overflow-y-auto pr-1">
                  <div className="space-y-2.5 pb-6">
                    <PremiumPageHeader
                      density="ultraCompact"
                      isSplitOpen={isDetailOpen}
                      eyebrow="Console propriétaire"
                      title={activeItem.label}
                      description={activeItem.description}
                      mobileDescription={activeItem.shortLabel}
                      secondaryAction={
                        <PremiumButton variant="secondary" size="sm" onClick={onRefresh} disabled={refreshing} icon={<RefreshCw className={classNames('h-3.5 w-3.5', refreshing && 'animate-spin')} />}>
                          Actualiser
                        </PremiumButton>
                      }
                      primaryAction={
                        <PremiumButton variant="ghost" size="sm" onClick={onSignOut} icon={<LogOut className="h-3.5 w-3.5" />}>
                          Sortir
                        </PremiumButton>
                      }
                    />

                    {searchSlot && (
                      <PremiumToolbar
                        density="ultraCompact"
                        layout="list"
                        search={searchSlot}
                        ariaLabel="Recherche globale console"
                        className="max-w-[760px]"
                      />
                    )}

                    <PremiumToolbar
                      density="ultraCompact"
                      layout="list"
                      ariaLabel="Navigation console mobile"
                      className="xl:hidden"
                      quickChips={CONSOLE_NAV_ITEMS.map((item) => ({
                        id: item.id,
                        label: item.shortLabel,
                        isActive: item.id === activeSpace,
                        onClick: () => onSpaceChange(item.id),
                      }))}
                    />

                    {children}
                  </div>
                </div>
              }
              detail={detailSlot ? <div className="h-full min-h-0 overflow-hidden">{detailSlot}</div> : undefined}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
