/**
 * Socle premium commun Samay Këur.
 *
 * Usage:
 * - PremiumButton: actions principales, secondaires et destructives.
 * - PremiumToolbar + PremiumSearchInput: recherche, filtres, colonnes sur les listes métier.
 * - PremiumTableSurface: conteneur unique des tableaux/cartes de liste.
 * - PremiumDrawerShell + PremiumDrawerActionSection: colonnes latérales métier.
 * - MiniMetricGrid: métriques compactes dans drawers, résumés et wizards.
 */
export const premiumTokens = {
  surface:
    'rounded-2xl border border-emerald-950/10 bg-[#fffdf7]/95 shadow-[0_20px_54px_rgba(15,23,42,0.055)] ring-1 ring-white/80',
  toolbar:
    'border-b border-emerald-950/10 bg-[linear-gradient(180deg,#fff6df,#fffdf7)] p-3.5 sm:p-4',
  field:
    'h-10 w-full rounded-xl border border-emerald-950/10 bg-white/95 text-sm font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition focus:border-brand-700 focus:ring-4 focus:ring-emerald-100',
  focusRing: 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100',
  softCard: 'rounded-2xl border border-emerald-950/10 bg-white/92 shadow-[0_12px_34px_rgba(15,23,42,0.045)]',
} as const;

export const premiumButtonClasses = {
  base:
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-55',
  create:
    'border border-[#0A3F30]/70 bg-gradient-to-br from-[#072F24] to-[#041812] text-white shadow-lg shadow-emerald-950/18 hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F] hover:shadow-emerald-950/24 active:from-[#041812] active:to-[#041812]',
  primary:
    'border border-[#0A3F30]/70 bg-gradient-to-br from-[#072F24] to-[#041812] text-white shadow-lg shadow-emerald-950/18 hover:-translate-y-0.5 hover:from-[#0A3F30] hover:to-[#06281F] hover:shadow-emerald-950/24 active:from-[#041812] active:to-[#041812]',
  secondary:
    'border border-emerald-950/10 bg-[#fffdf8] text-slate-700 shadow-sm hover:border-emerald-200 hover:bg-emerald-50',
  danger:
    'border border-red-200 bg-red-50 text-red-700 shadow-sm hover:border-red-300 hover:bg-red-100',
  ghost:
    'text-slate-600 hover:bg-emerald-50 hover:text-brand-950',
} as const;
