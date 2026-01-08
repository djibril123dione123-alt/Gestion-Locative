import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pagesDir = path.join(__dirname, '..', 'src', 'pages');

const pages = [
  'Immeubles.tsx',
  'Unites.tsx',
  'Locataires.tsx',
  'Depenses.tsx',
];

function updatePage(filePath) {
  console.log(`\nUpdating ${path.basename(filePath)}...`);

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  const tableName = path.basename(filePath, '.tsx').toLowerCase();

  const agencyIdPattern = /\.eq\('agency_id', profile\.agency_id\)/;
  if (!agencyIdPattern.test(content)) {
    content = content.replace(
      /from\('([^']+)'\)\s*\.select\('([^']+)'\)/g,
      (match, table, fields) => {
        if (table !== 'user_profiles' && table !== 'agencies') {
          return `from('${table}').select('${fields}').eq('agency_id', profile?.agency_id)`;
        }
        return match;
      }
    );
    modified = true;
  }

  const useEffectPattern = /useEffect\(\(\) => \{\s*load/;
  if (useEffectPattern.test(content) && !content.includes('if (profile?.agency_id)')) {
    content = content.replace(
      /useEffect\(\(\) => \{\s*(load\w+\(\);?)\s*\}, \[\]\);/g,
      `useEffect(() => {
    if (profile?.agency_id) {
      $1
    }
  }, [profile?.agency_id]);`
    );
    modified = true;
  }

  const loadFunctionPattern = /const (load\w+) = async \(\) => \{/;
  if (loadFunctionPattern.test(content) && !content.includes('if (!profile?.agency_id) return;')) {
    content = content.replace(
      /(const load\w+ = async \(\) => \{)\s*(try \{)?/g,
      `$1
    if (!profile?.agency_id) return;

    $2`
    );
    modified = true;
  }

  const insertPattern = /\.insert\(\[?\{([^}]+)\}\]?\)/g;
  if (insertPattern.test(content) && !content.includes('agency_id: profile?.agency_id')) {
    content = content.replace(
      /\.insert\(\[?\{([^}]+)\}\]?\)/g,
      (match, fields) => {
        if (!fields.includes('agency_id')) {
          return `.insert([{${fields}, agency_id: profile?.agency_id}])`;
        }
        return match;
      }
    );
    modified = true;
  }

  const blueButtonPattern = /bg-blue-600/g;
  if (blueButtonPattern.test(content)) {
    content = content.replace(/bg-blue-600/g, '');
    content = content.replace(/hover:bg-blue-700/g, '');
    content = content.replace(
      /className="([^"]*?)rounded-lg([^"]*?)"/g,
      (match, before, after) => {
        if (before.includes('border-slate') || before.includes('text-slate')) {
          return match;
        }
        return `className="${before}rounded-xl${after}" style={{background: 'linear-gradient(135deg, #F58220 0%, #E65100 100%)'}}`;
      }
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ ${path.basename(filePath)} updated`);
  } else {
    console.log(`  ℹ️  No changes needed`);
  }
}

console.log('🚀 Starting batch update...\n');

pages.forEach(fileName => {
  const filePath = path.join(pagesDir, fileName);

  if (fs.existsSync(filePath)) {
    try {
      updatePage(filePath);
    } catch (error) {
      console.log(`  ❌ Error updating ${fileName}: ${error.message}`);
    }
  } else {
    console.log(`\n⚠️  ${fileName} not found`);
  }
});

console.log('\n✅ Batch update complete!\n');
