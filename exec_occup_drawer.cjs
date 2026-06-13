const fs = require('fs');

function updateFile(filePath, updater) {
  try {
    let code = fs.readFileSync(filePath, 'utf8');
    let newCode = updater(code);
    if (code !== newCode) {
      fs.writeFileSync(filePath, newCode, 'utf8');
      console.log(`Updated ${filePath}`);
    }
  } catch (err) {}
}

updateFile('src/pages/OccupantsBaux.tsx', code => {
  let res = code.replace(
    /<div className="mt-4 grid grid-cols-2 gap-2">[\s\S]*?<\/div>/,
    `<div className="mt-8 space-y-6">
            <div>
              <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-400">Documents</p>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => onGeneratePdf(row)} disabled={pdfGenerating} className="flex items-center gap-3 rounded-xl border border-emerald-950/10 bg-white p-3 text-left text-sm font-bold text-slate-800 shadow-sm transition hover:border-brand-700 hover:text-brand-900 disabled:opacity-50">
                  <Download className="h-5 w-5 text-brand-700" />
                  {pdfGenerating ? 'Génération en cours...' : 'Contrat PDF'}
                </button>
              </div>
            </div>

            <div>
              <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-400">Gestion</p>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => onEditBail(row)} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                  <Pencil className="h-4 w-4 text-slate-500" />
                  Modifier la location
                </button>
                <button type="button" onClick={() => onEditOccupant(row)} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                  <UserPlus className="h-4 w-4 text-slate-500" />
                  Fiche locataire
                </button>
                {canRenew(row) && (
                  <button type="button" onClick={() => onRenew(row)} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                    <RefreshCw className="h-4 w-4 text-slate-500" />
                    Renouveler la location
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-red-400">Danger</p>
              <div className="flex flex-col gap-2">
                {activeStatus && (
                  <button type="button" onClick={() => onResiliate(row)} className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-3 text-left text-sm font-semibold text-red-700 transition hover:bg-red-100">
                    <Ban className="h-4 w-4" />
                    Résilier la location
                  </button>
                )}
                {canArchive && (
                  <button type="button" onClick={() => onArchive(row)} className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-3 text-left text-sm font-semibold text-red-700 transition hover:bg-red-100">
                    <Archive className="h-4 w-4" />
                    Archiver
                  </button>
                )}
              </div>
            </div>
          </div>`
  );
  return res;
});
