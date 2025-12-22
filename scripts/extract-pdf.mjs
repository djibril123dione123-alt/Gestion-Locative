import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

const workspaceRoot = path.resolve(process.cwd(), '..');
const pdfs = [
  {
    input: path.join(workspaceRoot, 'NOUVEAU CONTRAT DE LOCATION VIERGE.pdf'),
    output: path.join(process.cwd(), 'public', 'templates', 'contrat_raw.txt'),
  },
  {
    input: path.join(workspaceRoot, 'MANDAT  DE GERANCE VIERGE.pdf'),
    output: path.join(process.cwd(), 'public', 'templates', 'mandat_raw.txt'),
  },
];

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function extractOne({ input, output }) {
  try {
    const buf = await fs.promises.readFile(input);
    const data = await pdfParse(buf);
    await ensureDir(path.dirname(output));
    await fs.promises.writeFile(output, data.text, 'utf8');
    console.log(`[ok] extrait: ${path.basename(input)} -> ${output}`);
  } catch (e) {
    console.error(`[err] ${input}:`, e.message);
  }
}

for (const job of pdfs) {
  // eslint-disable-next-line no-await-in-loop
  await extractOne(job);
}

console.log('Extraction terminée.');


