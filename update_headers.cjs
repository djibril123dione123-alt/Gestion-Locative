const fs = require('fs');

function addImport(file, name) {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes(name + ',')) {
        content = content.replace(/import \{([\s\S]*?)\} from 'lucide-react';/, (match, p1) => {
            return `import {${p1}  ${name},\n} from 'lucide-react';`;
        });
        fs.writeFileSync(file, content);
    }
}

function updateHeaders(file, replacements) {
    let content = fs.readFileSync(file, 'utf8');
    for (const [search, replace] of replacements) {
        content = content.replace(search, replace);
    }
    fs.writeFileSync(file, content);
}

// Bailleurs
addImport('src/pages/Bailleurs.tsx', 'CircleUser');
addImport('src/pages/Bailleurs.tsx', 'DoorOpen');
addImport('src/pages/Bailleurs.tsx', 'Percent');

updateHeaders('src/pages/Bailleurs.tsx', [
    [/<th([^>]*)>Bailleur<\/th>/g, '<th$1><span className="flex items-center gap-1.5"><CircleUser className="h-3.5 w-3.5" /> Bailleur</span></th>'],
    [/<th([^>]*)>Téléphone<\/th>/g, '<th$1><span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Téléphone</span></th>'],
    [/<th([^>]*)>Commission<\/th>/g, '<th$1><span className="flex items-center gap-1.5"><Percent className="h-3.5 w-3.5" /> Commission</span></th>'],
    [/<th([^>]*)>Biens<\/th>/g, '<th$1><span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Biens</span></th>'],
    [/<th([^>]*)>Unités<\/th>/g, '<th$1><span className="flex items-center gap-1.5"><DoorOpen className="h-3.5 w-3.5" /> Unités</span></th>'],
    [/<th([^>]*)>Reliquats<\/th>/g, '<th$1><span className="flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Reliquats</span></th>'],
    [/<th([^>]*)>Net<\/th>/g, '<th$1><span className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Net</span></th>'],
    [/<th([^>]*)>Actions<\/th>/g, '<th$1><span className="flex items-center gap-1.5"><MoreHorizontal className="h-3.5 w-3.5" /> Actions</span></th>'],
]);

// Patrimoine
addImport('src/pages/Patrimoine.tsx', 'DoorOpen');
addImport('src/pages/Patrimoine.tsx', 'Activity');
addImport('src/pages/Patrimoine.tsx', 'CircleUser');

updateHeaders('src/pages/Patrimoine.tsx', [
    [/<th([^>]*)>Bien<\/th>/g, '<th$1><span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Bien</span></th>'],
    [/<th([^>]*)>Bailleur<\/th>/g, '<th$1><span className="flex items-center gap-1.5"><CircleUser className="h-3.5 w-3.5" /> Bailleur</span></th>'],
    [/<th([^>]*)>Unités<\/th>/g, '<th$1><span className="flex items-center gap-1.5"><DoorOpen className="h-3.5 w-3.5" /> Unités</span></th>'],
    [/<th([^>]*)>Occupation<\/th>/g, '<th$1><span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Occupation</span></th>'],
    [/<th([^>]*)>Reliquats<\/th>/g, '<th$1><span className="flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Reliquats</span></th>'],
    [/<th([^>]*)>Actions<\/th>/g, '<th$1><span className="flex items-center gap-1.5"><MoreHorizontal className="h-3.5 w-3.5" /> Actions</span></th>'],
]);

console.log("Headers updated");
