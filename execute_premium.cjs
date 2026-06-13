const fs = require('fs');
const path = require('path');

function updateFile(filePath, updater) {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const newCode = updater(code);
    if (code !== newCode) {
      fs.writeFileSync(filePath, newCode, 'utf8');
      console.log(`Updated ${filePath}`);
    }
  } catch (err) {
    console.error(`Error updating ${filePath}:`, err.message);
  }
}

// 1. Vocabulary
updateFile('src/pages/OccupantsBaux.tsx', code => {
  let res = code.replace(/Occupants & Baux/g, 'Locations');
  res = res.replace(/Occupants et Baux/g, 'Locations');
  res = res.replace(/Vue unifiée Occupants & Baux \(Phase 2\)\./g, 'Vue unifiée locataire → bail → unité');
  
  // Update Header Subtitle if it exists
  res = res.replace(
    /Une vue centralisée pour gérer vos locataires et leurs baux\./g,
    'Vue unifiée locataire → bail → unité.'
  );

  return res;
});

// Replace 'contrats actifs' to 'locations en cours' in Bailleurs and Patrimoine
['src/pages/Bailleurs.tsx', 'src/pages/Patrimoine.tsx', 'src/pages/TableauDeBordFinancierGlobal.tsx'].forEach(file => {
  updateFile(file, code => {
    let res = code.replace(/contrats actifs/g, 'locations en cours');
    res = res.replace(/contrat actif/g, 'location en cours');
    res = res.replace(/Contrats actifs/g, 'Locations en cours');
    return res;
  });
});

// 2. Drawers Premium
// Drawer Bailleurs - 3 zones d'actions
updateFile('src/pages/Bailleurs.tsx', code => {
  // We need to inject the 3 zones for Bailleurs.
  // We will do this carefully via a replace on the action buttons area.
  // "Actions principales : Rapport PDF, Mandat PDF. Gestion: Modifier, Paiements, Documents, Biens. Danger: Résilier"
  
  // Find where the actions are rendered in Bailleurs drawer
  // Look for: className="flex flex-col gap-2" inside Drawer
  let newCode = code;
  if (!code.includes('Actions principales')) {
    newCode = code.replace(
      /<div className="mt-6 flex flex-col gap-2">([\s\S]*?)<\/div>/,
      `<div className="mt-8 space-y-6">
        <div>
          <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-400">Actions principales</p>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => {}} className="flex items-center gap-3 rounded-xl border border-emerald-950/10 bg-white p-3 text-left text-sm font-bold text-slate-800 shadow-sm transition hover:border-brand-700 hover:text-brand-900">
              <FileText className="h-5 w-5 text-brand-700" />
              Générer rapport PDF
            </button>
            <button type="button" onClick={() => {}} className="flex items-center gap-3 rounded-xl border border-emerald-950/10 bg-white p-3 text-left text-sm font-bold text-slate-800 shadow-sm transition hover:border-brand-700 hover:text-brand-900">
              <FileSignature className="h-5 w-5 text-brand-700" />
              Mandat de gestion PDF
            </button>
          </div>
        </div>
        
        <div>
          <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-400">Gestion</p>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => { setEditingBailleur(selectedBailleur); setIsModalOpen(true); }} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              <Pencil className="h-4 w-4 text-slate-500" />
              Modifier les informations
            </button>
            <button type="button" onClick={() => {}} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              <CreditCard className="h-4 w-4 text-slate-500" />
              Historique des paiements
            </button>
            <button type="button" onClick={() => {}} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              <FolderOpen className="h-4 w-4 text-slate-500" />
              Documents associés
            </button>
            <button type="button" onClick={() => {}} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              <Building2 className="h-4 w-4 text-slate-500" />
              Biens immobiliers
            </button>
          </div>
        </div>

        <div>
          <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-red-400">Danger</p>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => handleDelete(selectedBailleur)} className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-3 text-left text-sm font-semibold text-red-700 transition hover:bg-red-100">
              <Trash2 className="h-4 w-4" />
              Résilier le mandat
            </button>
          </div>
        </div>
      </div>`
    );
  }
  return newCode;
});

// Update OccupantsBaux summary block
updateFile('src/pages/OccupantsBaux.tsx', code => {
  let res = code;
  // Replace Edge Function references
  res = res.replace(/Via Edge Function sécurisée/g, 'Enregistrement sécurisé');
  res = res.replace(/Exécution atomique/g, 'Validation finale');
  res = res.replace(/Cette action va créer l'occupant et le bail en une seule transaction\./g, 'Cette location sera créée et l’unité passera automatiquement au statut occupée.');

  // Modify commission display
  res = res.replace(/Commission agence \(\%\)/g, 'Commission agence');

  return res;
});

