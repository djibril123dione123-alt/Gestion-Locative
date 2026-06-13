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

// Patrimoine Drawer
updateFile('src/pages/Patrimoine.tsx', code => {
  // Replace standard list of actions with a segmented premium layout
  let res = code.replace(
    /<div className="mt-6 flex flex-col gap-2">([\s\S]*?)<\/div>/,
    `<div className="mt-8 space-y-6">
        <div>
          <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-400">Actions principales</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => { setEditingBien(selectedBien); setIsModalOpen(true); }} className="flex items-center gap-3 rounded-xl border border-emerald-950/10 bg-white p-3 text-left text-sm font-bold text-slate-800 shadow-sm transition hover:border-brand-700 hover:text-brand-900">
              <Pencil className="h-5 w-5 text-brand-700" />
              Modifier le bien
            </button>
            <button onClick={() => {}} className="flex items-center gap-3 rounded-xl border border-emerald-950/10 bg-white p-3 text-left text-sm font-bold text-slate-800 shadow-sm transition hover:border-brand-700 hover:text-brand-900">
              <Plus className="h-5 w-5 text-brand-700" />
              Ajouter une unité
            </button>
          </div>
        </div>

        <div>
          <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-400">Gestion</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => {}} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              <CreditCard className="h-4 w-4 text-slate-500" />
              Paiements liés
            </button>
            <button onClick={() => {}} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              <FolderOpen className="h-4 w-4 text-slate-500" />
              Documents associés
            </button>
          </div>
        </div>
      </div>`
  );
  return res;
});

// OccupantsBaux Drawer
updateFile('src/pages/OccupantsBaux.tsx', code => {
  let res = code.replace(
    /<div className="mt-6 flex flex-col gap-2">([\s\S]*?)<\/div>/,
    `<div className="mt-8 space-y-6">
        <div>
          <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-400">Documents</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => {}} className="flex items-center gap-3 rounded-xl border border-emerald-950/10 bg-white p-3 text-left text-sm font-bold text-slate-800 shadow-sm transition hover:border-brand-700 hover:text-brand-900">
              <FileText className="h-5 w-5 text-brand-700" />
              Contrat PDF
            </button>
            <button onClick={() => {}} className="flex items-center gap-3 rounded-xl border border-emerald-950/10 bg-white p-3 text-left text-sm font-bold text-slate-800 shadow-sm transition hover:border-brand-700 hover:text-brand-900">
              <FileCheck2 className="h-5 w-5 text-brand-700" />
              État des lieux PDF
            </button>
          </div>
        </div>

        <div>
          <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-400">Gestion</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => setEditingContrat(selectedRow.contrat_id)} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              <Pencil className="h-4 w-4 text-slate-500" />
              Modifier la location
            </button>
            <button onClick={() => {}} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              <UserCircle className="h-4 w-4 text-slate-500" />
              Fiche locataire
            </button>
            <button onClick={() => {}} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              <CreditCard className="h-4 w-4 text-slate-500" />
              Encaissements
            </button>
          </div>
        </div>

        <div>
          <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-red-400">Danger</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => setTargetIdForDangerAction(selectedRow.contrat_id)} className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-3 text-left text-sm font-semibold text-red-700 transition hover:bg-red-100">
              <Archive className="h-4 w-4" />
              Résilier la location
            </button>
          </div>
        </div>
      </div>`
  );
  return res;
});
