import React from 'react';
import {
  Clock3,
  LogOut,
  Menu,
  RefreshCw,
} from 'lucide-react';

import { AppSidebarFrame } from '../../components/layout/AppSidebarFrame';
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
  searchSlot,
  primaryAction,
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
  searchSlot?: React.ReactNode;
  primaryAction?: React.ReactNode;
  detailSlot?: React.ReactNode;
  isDetailOpen?: boolean;
  children: React.ReactNode;
}) {
  const activeItem = CONSOLE_NAV_ITEMS.find((item) => item.id === activeSpace) ?? CONSOLE_NAV_ITEMS[0];
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  const navigate = (space: ConsoleSpace) => {
    onSpaceChange(space);
    setIsMobileOpen(false);
  };

  return (
    <div className="h-screen overflow-hidden bg-[#f5efe3] text-slate-950">
      <div className="flex h-full min-h-0">
        <AppSidebarFrame
          items={CONSOLE_NAV_ITEMS}
          activeItem={activeSpace}
          onNavigate={(item) => navigate(item as ConsoleSpace)}
          isOpen={isMobileOpen}
          onClose={() => setIsMobileOpen(false)}
          isCollapsed={isCollapsed}
          onToggleCollapsed={() => setIsCollapsed((value) => !value)}
          footer={(expanded) => (
            <div className={expanded ? 'space-y-2' : 'space-y-1'}>
              <div
                title="Dernière mise à jour de la console"
                className={`rounded-xl border border-white/10 bg-white/[0.06] text-emerald-50/75 ${expanded ? 'px-3 py-2.5' : 'p-2 text-center'}`}
              >
                {expanded ? (
                  <>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-300">
                      <Clock3 className="h-3.5 w-3.5" />
                      Dernière mise à jour
                    </div>
                    <p className="mt-1 text-[11px] font-black text-white">
                      {lastLoadedAt ? formatAdminDateTime(lastLoadedAt) : 'En attente'}
                    </p>
                  </>
                ) : (
                  <Clock3 className="mx-auto h-4 w-4" />
                )}
              </div>
              <button
                type="button"
                onClick={onSignOut}
                title="Quitter la console"
                className={`flex w-full items-center rounded-xl text-xs font-black text-orange-200 transition hover:bg-orange-400/10 hover:text-orange-100 ${expanded ? 'gap-2 px-3 py-2' : 'justify-center p-2'}`}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {expanded && 'Quitter la console'}
              </button>
            </div>
          )}
        />

        <main className="h-full min-w-0 flex-1 overflow-hidden">
          <div className="mx-auto h-full max-w-[1760px] px-2 py-2 sm:px-3 lg:px-4">
            <SplitViewShell
              isDetailOpen={isDetailOpen}
              size="compact"
              desktopAt="lg"
              className="h-full min-h-0 items-stretch"
              mainClassName={classNames('h-full min-h-0', isDetailOpen && 'hidden lg:block')}
              detailClassName="h-full min-h-0 lg:sticky lg:top-0 lg:h-[calc(100dvh-1rem)]"
              main={(
                <div className="h-full min-h-0 overflow-y-auto pr-0.5 [scrollbar-gutter:stable]">
                  <div className="space-y-2 pb-5">
                    <PremiumPageHeader
                      density="ultraCompact"
                      isSplitOpen={isDetailOpen}
                      eyebrow="Console propriétaire"
                      title={activeItem.label}
                      description={activeItem.description}
                      mobileDescription={activeItem.shortLabel}
                      primaryAction={primaryAction}
                      secondaryAction={(
                        <div className="flex items-center gap-1.5">
                          <PremiumButton
                            variant="secondary"
                            size="sm"
                            onClick={() => setIsMobileOpen(true)}
                            className="lg:hidden"
                            icon={<Menu className="h-3.5 w-3.5" />}
                          >
                            Menu
                          </PremiumButton>
                          <PremiumButton
                            variant="secondary"
                            size="sm"
                            onClick={onRefresh}
                            disabled={refreshing}
                            icon={<RefreshCw className={classNames('h-3.5 w-3.5', refreshing && 'animate-spin')} />}
                          >
                            Actualiser
                          </PremiumButton>
                        </div>
                      )}
                    />

                    <PremiumToolbar
                      density="ultraCompact"
                      layout="list"
                      ariaLabel="Recherche et navigation console"
                      search={searchSlot}
                      quickChips={CONSOLE_NAV_ITEMS.map((item) => ({
                        id: item.id,
                        label: item.shortLabel,
                        isActive: item.id === activeSpace,
                        onClick: () => navigate(item.id),
                      }))}
                      className="[&>div+div]:xl:hidden"
                    />

                    {children}
                  </div>
                </div>
              )}
              detail={detailSlot ? <div className="h-full min-h-0 overflow-hidden">{detailSlot}</div> : undefined}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
