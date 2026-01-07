import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pagesDir = path.join(__dirname, '..', 'src', 'pages');

const filesToMigrate = [
  'Bailleurs.tsx',
  'Immeubles.tsx',
  'Unites.tsx',
  'Locataires.tsx',
  'Contrats.tsx',
  'Paiements.tsx',
  'Depenses.tsx',
  'Commissions.tsx',
  'LoyersImpayes.tsx',
  'FiltresAvances.tsx',
  'TableauDeBordFinancierGlobal.tsx',
];

function migrateFile(filePath) {
  console.log(`\nMigrating ${path.basename(filePath)}...`);

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  const useAuthImportRegex = /from ['"]\.\.\/contexts\/AuthContext['"]/;
  if (!content.match(useAuthImportRegex)) {
    console.log('  ⚠️  No useAuth import found');
    return;
  }

  const hasProfileInUseAuth = /const\s*\{[^}]*profile[^}]*\}\s*=\s*useAuth\(\)/;
  if (!hasProfileInUseAuth.test(content)) {
    content = content.replace(
      /const\s*\{\s*user\s*\}\s*=\s*useAuth\(\)/g,
      'const { user, profile } = useAuth()'
    );
    modified = true;
    console.log('  ✅ Added profile to useAuth destructuring');
  }

  const selectRegex = /supabase\s*\.from\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\.select\s*\(/g;
  let match;
  let selectCount = 0;

  while ((match = selectRegex.exec(content)) !== null) {
    const tableName = match[1];

    const startPos = match.index;
    const restOfContent = content.substring(startPos);

    const hasAgencyId = restOfContent.substring(0, 300).includes('.eq(\'agency_id\'');

    if (!hasAgencyId && tableName !== 'user_profiles' && tableName !== 'agencies' && tableName !== 'agency_settings' && tableName !== 'subscription_plans') {
      console.log(`  ℹ️  Table ${tableName} might need agency_id filter`);
      selectCount++;
    }
  }

  if (selectCount > 0) {
    console.log(`  ℹ️  Found ${selectCount} SELECT queries that might need agency_id`);
  }

  const insertRegex = /\.insert\s*\(\s*\{/g;
  let insertMatch;
  let insertCount = 0;

  while ((insertMatch = insertRegex.exec(content)) !== null) {
    const startPos = insertMatch.index;
    const snippet = content.substring(Math.max(0, startPos - 100), startPos + 200);

    if (!snippet.includes('agency_id')) {
      insertCount++;
      console.log('  ℹ️  Found INSERT that might need agency_id');
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ File updated`);
  } else {
    console.log(`  ℹ️  No automatic changes made`);
  }
}

console.log('🚀 Starting agency_id migration...\n');

filesToMigrate.forEach(fileName => {
  const filePath = path.join(pagesDir, fileName);

  if (fs.existsSync(filePath)) {
    migrateFile(filePath);
  } else {
    console.log(`\n⚠️  ${fileName} not found`);
  }
});

console.log('\n\n✅ Migration scan complete!\n');
console.log('📝 Manual steps required:');
console.log('   1. Add .eq("agency_id", profile?.agency_id) to all SELECT queries');
console.log('   2. Add agency_id: profile?.agency_id to all INSERT objects');
console.log('   3. Add if (!profile?.agency_id) return; checks in load functions');
console.log('   4. Add profile?.agency_id checks in useEffect dependencies\n');
