import React from 'react';
import { LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { BrandMark } from '../../components/brand/BrandLogo';
import { AdminButton, AdminPartialDataNotice } from '../../components/console/AdminPrimitives';
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
  children: React.ReactNode;
}) {
  const activeItem = CONSOLE_NAV_ITEMS.find((item) => item.id === activeSpace) ?? CONSOLE_NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#f5efe3] text-slate-950">
      <div className="grid min-h-screen xl:grid-cols-[248px_1fr]">
        <aside className="hidden border-r border-emerald-950/10 bg-emerald-950 text-white xl:block">
          <div className="sticky top-0 flex h-screen flex-col p-3.5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.12)]">
              <div className="flex items-center gap-3">
                <BrandMark size="sm" tone="dark" animated withTile={false} className="shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-[0.68rem] font-black uppercase tracking-[0.16em] text-emerald-100">Samay Këur</p>
                  <h1 className="text-base font-black">Console admin</h1>
                </div>
              </div>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[0.68rem] font-black text-emerald-50">
                <ShieldCheck className="h-3.5 w-3.5" />
                Super-admin
              </div>
            </div>

            <nav className="mt-3 space-y-1">
              {CONSOLE_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeSpace;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSpaceChange(item.id)}
                    className={classNames(
                      'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[0.78rem] font-black transition',
                      active ? 'border-orange-300/35 bg-white text-emerald-950 shadow-md' : 'border-transparent text-emerald-50/75 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.055] p-3 text-xs font-semibold text-emerald-50/70">
              Dernier chargement<br />
              <span className="font-black text-white">{lastLoadedAt ? formatAdminDateTime(lastLoadedAt) : 'En attente'}</span>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-emerald-950/10 bg-[#f5efe3]/90 px-3 py-2.5 backdrop-blur-xl sm:px-5">
            <div className="mx-auto flex max-w-[1680px] flex-col gap-2.5">
              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-orange-700">Console propriétaire</p>
                  <h2 className="text-lg font-black text-slate-950 sm:text-xl">{activeItem.label}</h2>
                  <p className="mt-0.5 max-w-3xl text-xs font-semibold leading-5 text-slate-600 sm:text-sm">{activeItem.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AdminButton onClick={onRefresh} disabled={refreshing}>
                    <RefreshCw className={classNames('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                    Actualiser
                  </AdminButton>
                  <AdminButton variant="ghost" onClick={onSignOut}>
                    <LogOut className="h-3.5 w-3.5" />
                    Sortir
                  </AdminButton>
                </div>
              </div>
              {searchSlot && <div className="relative z-40">{searchSlot}</div>}
              <div className="flex gap-2 overflow-x-auto pb-1 xl:hidden">
                {CONSOLE_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSpaceChange(item.id)}
                      className={classNames(
                        'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-black',
                        activeSpace === item.id ? 'border-emerald-950 bg-emerald-950 text-white' : 'border-slate-200 bg-white text-slate-700',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.shortLabel}
                    </button>
                  );
                })}
              </div>
              <AdminPartialDataNotice errors={partialErrors} />
            </div>
          </header>
          <main className="mx-auto max-w-[1680px] px-3 py-3.5 sm:px-5 sm:py-4">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
