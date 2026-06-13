const fs = require('fs');

let b = fs.readFileSync('src/pages/Bailleurs.tsx', 'utf8');
b = b.replace(/import \{ MetricCard, MiniMetric \} from '\.\.\/components\/ui\/MetricCard';/, 'import { MiniMetric } from \'../components/ui/MetricCard\';');

// Remove remaining DrawerMetric if any
b = b.replace(/function DrawerMetric[\s\S]*?<\/div>\n  \);\n}/g, '');
// Remove remaining MetricCard declaration
b = b.replace(/function MetricCard[\s\S]*?<\/article>\n  \);\n}/g, '');

b = b.replace(/tone: 'emerald' \| 'gold' \| 'red' \| 'blue'/, 'tone: \'emerald\' | \'amber\' | \'red\' | \'blue\'');
b = b.replace(/gold: \{ gradient: 'from-white to-amber-50\/65'/, 'amber: { gradient: \'from-white to-amber-50/65\'');
b = b.replace(/tones\[tone\];/g, 'tones[tone as keyof typeof tones];');
fs.writeFileSync('src/pages/Bailleurs.tsx', b, 'utf8');

let m = fs.readFileSync('src/components/ui/MetricCard.tsx', 'utf8');
m = m.replace(/import React, \{ ReactNode \} from 'react';/, 'import { ReactNode } from \'react\';');
fs.writeFileSync('src/components/ui/MetricCard.tsx', m, 'utf8');
