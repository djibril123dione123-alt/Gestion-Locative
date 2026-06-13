const fs = require('fs');
let file = 'src/pages/OccupantsBaux.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update KPIs
const oldKpi = `                  className={\`group flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm transition-all duration-200 \${
                    activeTab === tab.id
                      ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-300/40 shadow-emerald-100'
                      : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/50'
                  }\`}
                >
                  <span>
                    <span className={\`block text-2xl font-black \${activeTab === tab.id ? 'text-emerald-700' : 'text-slate-800'}\`}>
                      {counts[tab.id] ?? 0}
                    </span>
                    <span className={\`mt-1 block text-xs font-bold uppercase tracking-wide \${activeTab === tab.id ? 'text-emerald-600' : 'text-slate-500'}\`}>
                      {tab.label}
                    </span>
                  </span>
                  <span className={\`flex h-11 w-11 items-center justify-center rounded-2xl \${getStatusKpiTone(tab.tone)}\`}>
                    <Icon className="h-5 w-5" />
                  </span>
                </button>`;

const newKpi = `                  className={\`group relative min-w-0 rounded-2xl border bg-gradient-to-br p-3 text-left shadow-[0_10px_28px_rgba(15,23,42,0.045)] ring-1 transition-all duration-200 \${
                    activeTab === tab.id
                      ? 'border-emerald-300 from-emerald-50/80 to-emerald-50/30 ring-emerald-300/50'
                      : 'border-emerald-950/10 from-white to-slate-50/65 ring-white/70 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)]'
                  }\`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={\`truncate text-[0.68rem] font-bold uppercase tracking-[0.12em] \${activeTab === tab.id ? 'text-emerald-800' : 'text-slate-500'}\`}>
                        {tab.label}
                      </p>
                      <p className={\`mt-1.5 truncate text-[1.1rem] font-extrabold tracking-tight sm:text-[1.18rem] \${activeTab === tab.id ? 'text-emerald-950' : 'text-slate-950'}\`}>
                        {counts[tab.id] ?? 0}
                      </p>
                    </div>
                    <div className={\`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-1 transition-colors \${
                      activeTab === tab.id
                        ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                        : 'bg-slate-50 text-slate-400 ring-slate-100 group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:ring-emerald-100'
                    }\`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                </button>`;

content = content.replace(oldKpi, newKpi);

// Update Toolbar detached
const oldToolbarWrapper = `          {/* Tableau principal */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Toolbar */}
            <div className="border-b border-slate-100 px-4 py-4 sm:px-6">`;

const newToolbarWrapper = `          {/* Toolbar */}
          <section className="rounded-2xl border border-emerald-950/10 bg-[#fffdf7]/95 p-3.5 sm:p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] ring-1 ring-white/80">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">`;

content = content.replace(oldToolbarWrapper, newToolbarWrapper);

// Change search input styles to match Patrimoine
const oldSearchInput = `                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm font-medium transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-400"`;
const newSearchInput = `                    className="h-10 w-full rounded-xl border border-emerald-950/10 bg-white/95 pl-9 pr-3 text-sm font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"`;
content = content.replace(oldSearchInput, newSearchInput);

// End of toolbar logic
const oldToolbarEnd = `              {(searchTerm || activeFilterCount > 0) && (
                <p className="mt-2 text-xs font-medium text-slate-500">
                  {filtered.length} résultat{filtered.length !== 1 ? 's' : ''} affiché{filtered.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Table desktop / Cards mobile */}`;
const newToolbarEnd = `              {(searchTerm || activeFilterCount > 0) && (
                <p className="mt-2 text-xs font-medium text-slate-500">
                  {filtered.length} résultat{filtered.length !== 1 ? 's' : ''} affiché{filtered.length !== 1 ? 's' : ''}
                </p>
              )}
          </section>

          {/* Tableau principal */}
          <div className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-[#fffdf7]/95 shadow-[0_18px_48px_rgba(15,23,42,0.06)] ring-1 ring-white/80">
            {/* Table desktop / Cards mobile */}`;
content = content.replace(oldToolbarEnd, newToolbarEnd);

// Table Header colors unification
// OccupantsBaux has <thead className="sticky top-0 z-10 bg-[#f8f3e8]/75 shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md">
// Bailleurs has <thead className="bg-[#f8f3e8]/80">
// Patrimoine has <thead className="bg-[#f8f3e8]/70 text-left text-[0.66rem] font-bold uppercase tracking-wider text-slate-400">
const unifyTableHeaderOb = `<thead className="sticky top-0 z-10 bg-[#f8f3e8]/75 shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md">`;
const unifyTableHeaderObNew = `<thead className="sticky top-0 z-10 bg-[#f8f3e8]/70 shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md text-left text-[0.66rem] font-bold uppercase tracking-wider text-slate-400">`;
content = content.replace(unifyTableHeaderOb, unifyTableHeaderObNew);

// Adjust row styles in OccupantsBaux
const unifyTableRowOb = `className={\`group cursor-pointer transition-colors \${selected ? 'bg-emerald-50/90 ring-1 ring-inset ring-emerald-200' : 'hover:bg-slate-50/70'}\`}`;
const unifyTableRowObNew = `className={\`group cursor-pointer border-b border-slate-100 transition-colors \${selected ? 'bg-emerald-50/90 ring-1 ring-inset ring-emerald-200' : 'hover:bg-emerald-50/45'}\`}`;
content = content.replace(unifyTableRowOb, unifyTableRowObNew);

fs.writeFileSync(file, content);

// Bailleurs Toolbar
let file2 = 'src/pages/Bailleurs.tsx';
let content2 = fs.readFileSync(file2, 'utf8');

const bailleursToolbarStart = `          <section className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-[#fffdf7]/95 shadow-[0_22px_60px_rgba(15,23,42,0.07)] ring-1 ring-white/80">
          <div className="border-b border-emerald-950/10 bg-[linear-gradient(180deg,#fff6df,#fffdf7)] p-3.5 sm:p-4">`;
const bailleursToolbarStartNew = `          {/* Toolbar */}
          <section className="rounded-2xl border border-emerald-950/10 bg-[#fffdf7]/95 p-3.5 sm:p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] ring-1 ring-white/80">`;
content2 = content2.replace(bailleursToolbarStart, bailleursToolbarStartNew);

const bSearchInput = `                  className="sk-input pl-10 pr-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"`;
const bSearchInputNew = `                  className="h-10 w-full rounded-xl border border-emerald-950/10 bg-white/95 pl-9 pr-3 text-sm font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none focus:border-brand-700 focus:ring-4 focus:ring-emerald-100"`;
content2 = content2.replace(bSearchInput, bSearchInputNew);

const bToolbarEnd = `              {activeFilterCount > 0 && (
                <button type="button" onClick={() => setActiveFilter('all')} className="self-start rounded-full bg-[#fffdf8] px-2.5 py-1 font-semibold text-emerald-800 ring-1 ring-emerald-100 hover:bg-emerald-50 sm:self-auto">
                  {activeFilterLabel} · Réinitialiser
                </button>
              )}
            </div>
            {showFilters && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {filterOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setActiveFilter(option.id)}
                      className={\`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition \${activeFilter === option.id ? 'bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-200' : 'text-slate-600 hover:bg-slate-50'}\`}
                    >
                      <option.icon className={\`h-4 w-4 \${activeFilter === option.id ? 'text-emerald-700' : 'text-slate-400'}\`} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">`;
const bToolbarEndNew = `              {activeFilterCount > 0 && (
                <button type="button" onClick={() => setActiveFilter('all')} className="self-start rounded-full bg-[#fffdf8] px-2.5 py-1 font-semibold text-emerald-800 ring-1 ring-emerald-100 hover:bg-emerald-50 sm:self-auto">
                  {activeFilterLabel} · Réinitialiser
                </button>
              )}
            </div>
            {showFilters && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {filterOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setActiveFilter(option.id)}
                      className={\`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition \${activeFilter === option.id ? 'bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-200' : 'text-slate-600 hover:bg-slate-50'}\`}
                    >
                      <option.icon className={\`h-4 w-4 \${activeFilter === option.id ? 'text-emerald-700' : 'text-slate-400'}\`} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
          
          {/* Tableau principal */}
          <section className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-[#fffdf7]/95 shadow-[0_18px_48px_rgba(15,23,42,0.06)] ring-1 ring-white/80">
            <div className="overflow-x-auto">`;
content2 = content2.replace(bToolbarEnd, bToolbarEndNew);

const unifyTableHeaderB = `<thead className="bg-[#f8f3e8]/80">`;
const unifyTableHeaderBNew = `<thead className="bg-[#f8f3e8]/70 text-left text-[0.66rem] font-bold uppercase tracking-wider text-slate-400">`;
content2 = content2.replace(unifyTableHeaderB, unifyTableHeaderBNew);

fs.writeFileSync(file2, content2);
console.log("Toolbars and KPIs updated");
