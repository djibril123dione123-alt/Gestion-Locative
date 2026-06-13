const fs = require('fs');

function updateFile(path, updater) {
  try {
    const code = fs.readFileSync(path, 'utf8');
    const newCode = updater(code);
    if (code !== newCode) {
      fs.writeFileSync(path, newCode, 'utf8');
      console.log(`Updated ${path}`);
    } else {
      console.log(`No changes needed for ${path}`);
    }
  } catch (err) {
    console.error(`Error updating ${path}:`, err.message);
  }
}

// 1. Fix Bailleurs Drawer Auto-Select
updateFile('src/pages/Bailleurs.tsx', code => {
  // Replace inline MetricCard with imported UnifiedMetricCard
  let newCode = code.replace(
    /function MetricCard[\s\S]*?<\/article>\n  \);\n}/,
    ''
  );
  newCode = newCode.replace(
    /function DrawerMetric[\s\S]*?<\/div>\n  \);\n}/,
    ''
  );
  
  if (!newCode.includes('import { MetricCard, MiniMetric }')) {
    newCode = newCode.replace(
      "import { SearchableSelect } from '../components/ui/SearchableSelect';",
      "import { SmartCombobox } from '../components/ui/SmartCombobox';\nimport { MetricCard, MiniMetric } from '../components/ui/MetricCard';"
    );
  }

  // Replace SearchableSelect with SmartCombobox
  newCode = newCode.replace(/SearchableSelect/g, 'SmartCombobox');

  // Replace MetricCard usages
  newCode = newCode.replace(/<DrawerMetric/g, '<MiniMetric');

  return newCode;
});

// 2. Fix Patrimoine
updateFile('src/pages/Patrimoine.tsx', code => {
  let newCode = code.replace(
    /function MetricCard[\s\S]*?<\/article>\n  \);\n}/,
    ''
  );
  newCode = newCode.replace(
    /function MiniMetric[\s\S]*?<\/div>\n  \);\n}/,
    ''
  );

  if (!newCode.includes('import { MetricCard, MiniMetric }')) {
    newCode = newCode.replace(
      "import { SearchableSelect } from '../components/ui/SearchableSelect';",
      "import { SmartCombobox } from '../components/ui/SmartCombobox';\nimport { MetricCard, MiniMetric } from '../components/ui/MetricCard';"
    );
  }
  
  // Replace SearchableSelect with SmartCombobox
  newCode = newCode.replace(/SearchableSelect/g, 'SmartCombobox');

  return newCode;
});

// 3. Fix OccupantsBaux
updateFile('src/pages/OccupantsBaux.tsx', code => {
  let newCode = code;

  if (!newCode.includes('import { SmartCombobox }')) {
    newCode = newCode.replace(
      "import { SearchableSelect } from '../components/ui/SearchableSelect';",
      "import { SmartCombobox } from '../components/ui/SmartCombobox';"
    );
  }

  // Hide secondary columns
  newCode = newCode.replace(
    /className=\{\`px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 \$\{selectedRow \? 'hidden' : ''\}\`/g,
    'className={`px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 ${selectedRow ? \'hidden\' : \'hidden lg:table-cell\'}`'
  );
  
  // Also fix td hidden logic
  newCode = newCode.replace(
    /className=\{\`px-5 py-3.5 \$\{compact \? 'hidden' : ''\}\`/g,
    'className={`px-5 py-3.5 ${compact ? \'hidden\' : \'hidden lg:table-cell\'}`'
  );

  // Replace SearchableSelect with SmartCombobox
  newCode = newCode.replace(/SearchableSelect/g, 'SmartCombobox');

  return newCode;
});

// 4. Fix OwnerWorkspace
updateFile('src/components/owner/OwnerWorkspace.tsx', code => {
  let newCode = code;
  
  // Fix terminology
  newCode = newCode.replace(/Contrats actifs/g, 'Locations en cours');
  newCode = newCode.replace(/contrats actifs/g, 'locations en cours');
  newCode = newCode.replace(/contrats actif/g, 'locations en cours');
  newCode = newCode.replace(/contrat actif/g, 'location en cours');

  // Fix grid-cols for mobile
  newCode = newCode.replace(
    /<section className="grid grid-cols-2 gap-3 xl:grid-cols-4">/g,
    '<section className="grid grid-cols-2 gap-3 xl:grid-cols-4">'
  ); // Already fine

  newCode = newCode.replace(
    /<div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">/g,
    '<div className="mt-3 grid grid-cols-2 gap-2.5 xl:grid-cols-4">'
  );
  
  newCode = newCode.replace(
    /<div className="mt-4 grid grid-cols-2 gap-2">/g,
    '<div className="mt-4 grid grid-cols-2 gap-2">'
  );

  return newCode;
});

// 5. Fix Supabase errors
updateFile('src/lib/supabase.ts', code => {
  if (!code.includes('SupabaseErrorInterceptor')) {
    return code + `\n
// Interceptor logic for human-readable errors
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (!response.ok) {
    try {
      const clone = response.clone();
      const body = await clone.json();
      if (body.error && (body.error.includes('token') || body.error.includes('JWT'))) {
        body.message = 'Votre session a expiré. Veuillez vous reconnecter.';
        return new Response(JSON.stringify(body), { status: response.status, headers: response.headers });
      }
    } catch (e) {}
  }
  return response;
};\n`;
  }
  return code;
});
