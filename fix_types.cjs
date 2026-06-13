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

// 1. Fix Supabase TS
updateFile('src/lib/supabase.ts', code => {
  // Remove duplicates of originalFetch
  const lines = code.split('\n');
  const out = [];
  let interceptorCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const originalFetch')) {
      interceptorCount++;
      if (interceptorCount > 1) {
        // Skip next 14 lines
        i += 14;
        continue;
      }
    }
    out.push(lines[i]);
  }
  return out.join('\n');
});

// 2. Fix Bailleurs
updateFile('src/pages/Bailleurs.tsx', code => {
  // Tone gold -> amber
  let newCode = code.replace(/tone="gold"/g, 'tone="amber"');
  // Remove empty MetricCard and DrawerMetric completely
  newCode = newCode.replace(/function MetricCard[\s\S]*?<\/article>\n  \);\n}/g, '');
  newCode = newCode.replace(/function DrawerMetric[\s\S]*?<\/div>\n  \);\n}/g, '');
  return newCode;
});

// 3. Fix Patrimoine
updateFile('src/pages/Patrimoine.tsx', code => {
  let newCode = code.replace(/function MetricCard[\s\S]*?<\/article>\n  \);\n}/g, '');
  newCode = newCode.replace(/function MiniMetric[\s\S]*?<\/div>\n  \);\n}/g, '');
  return newCode;
});

// 4. Fix SmartCombobox searchPlaceholder
updateFile('src/components/ui/SmartCombobox.tsx', code => {
  let newCode = code;
  if (!code.includes('searchPlaceholder')) {
    newCode = newCode.replace(
      'placeholder?: string;',
      'placeholder?: string;\n  searchPlaceholder?: string;'
    );
  }
  return newCode;
});
