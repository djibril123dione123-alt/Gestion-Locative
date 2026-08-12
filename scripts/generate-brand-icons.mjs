// Génère TOUS les dérivés raster de l'identité (icône UI, favicon, apple-touch,
// PWA, maskable, OG) à partir du VRAI emblème de marque :
// public/brand/emblem-master.png — copie sans perte de
// "samay Keur assets/brand/logos/embleme Samay Keur sans fond.png",
// vérifiée par somme SHA-256. Jamais de recréation/redessin du logo :
// uniquement des recadrages/redimensionnements/compositions de ce fichier
// source unique. Relancer `node scripts/generate-brand-icons.mjs` après tout
// remplacement de emblem-master.png.
import sharp from "sharp";
import { readFileSync, mkdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(root, "..", "public");
const brand = path.join(pub, "brand");

const BRAND_INK = { r: 0x0d, g: 0x1b, b: 0x16, alpha: 1 }; // #0D1B16 — background_color/theme_color du manifest
const CHAMPAGNE = "#D9AA5E";

const master = readFileSync(path.join(brand, "emblem-master.png"));

/** Emblème seul, transparent, recadré/pad — pour usage UI inline (navbar, sidebar, login, loader). */
async function transparentMark(size, outPath, pad = 0) {
  const inner = size - pad * 2;
  await sharp(master)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log("✓", path.relative(pub, outPath), `${size}x${size} (transparent)`);
}

/** Emblème sur fond plein vert profond — pour favicon/apple-touch/PWA (jamais de coin transparent parasite). */
async function filledIcon(size, outPath, { pad = Math.round(size * 0.16) } = {}) {
  const inner = size - pad * 2;
  const mark = await sharp(master)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BRAND_INK } })
    .composite([{ input: mark, left: pad, top: pad }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log("✓", path.relative(pub, outPath), `${size}x${size} (fond plein)`);
}

/** Icône maskable : logo confiné à la zone de sécurité (~66% central), fond plein sur tout le canevas
 *  pour qu'un cercle/squircle appliqué par l'OS ne rogne jamais le symbole. */
async function maskableIcon(size, outPath) {
  const safeZone = Math.round(size * 0.66);
  const pad = Math.round((size - safeZone) / 2);
  const mark = await sharp(master)
    .resize(safeZone, safeZone, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BRAND_INK } })
    .composite([{ input: mark, left: pad, top: pad }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log("✓", path.relative(pub, outPath), `${size}x${size} (maskable)`);
}

async function main() {
  mkdirSync(brand, { recursive: true });

  // Icône UI inline (navbar, sidebar, login, loader) — transparente, jamais de tuile pré-cuite.
  await transparentMark(512, path.join(brand, "mark-transparent.png"));

  // Favicons — transparents, lisibles sur onglet clair ou sombre.
  await transparentMark(32, path.join(pub, "favicon-32.png"));
  await transparentMark(16, path.join(pub, "favicon-16.png"));
  copyFileSync(path.join(brand, "emblem-master.svg"), path.join(pub, "favicon.svg"));
  console.log("✓ favicon.svg (copie directe du SVG maître)");

  // Apple touch icon — fond plein requis (iOS remplit le transparent en noir sinon).
  await filledIcon(180, path.join(pub, "apple-touch-icon.png"));

  // PWA — fond plein pour éviter tout artefact de coin transparent selon le launcher.
  await filledIcon(192, path.join(pub, "icon-192.png"));
  await filledIcon(512, path.join(pub, "icon-512.png"));

  // PWA maskable — zone de sécurité dédiée, jamais partagée avec purpose:"any".
  await maskableIcon(192, path.join(pub, "icon-192-maskable.png"));
  await maskableIcon(512, path.join(pub, "icon-512-maskable.png"));

  // Icône App tile "primary" (utilisée hors contexte OS, ex. écrans internes) — même traitement fond plein.
  await filledIcon(512, path.join(brand, "app-icon-primary.png"), { pad: Math.round(512 * 0.14) });

  // Open Graph / partage social — vraie composition 1200x630, jamais l'icône carrée.
  const markPng = await sharp(master)
    .resize(300, 300, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const ogSvg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="#071510"/>
    <rect width="1200" height="630" fill="url(#bgGrad)"/>
    <text x="470" y="300" fill="#F6F1E3" font-family="Georgia, 'Times New Roman', serif" font-size="72" font-weight="700" letter-spacing="2">Samay Këur</text>
    <text x="470" y="350" fill="${CHAMPAGNE}" font-family="Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="4">CENTRALISEZ. GÉREZ. MAÎTRISEZ.</text>
    <text x="470" y="410" fill="#B9C6BC" font-family="Arial, sans-serif" font-size="22" letter-spacing="0.5">Gestion locative professionnelle — app.samaykeur.com</text>
    <defs>
      <radialGradient id="bgGrad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1000 0) rotate(135) scale(1400)">
        <stop stop-color="#1F3B2E"/>
        <stop offset="1" stop-color="#071510"/>
      </radialGradient>
    </defs>
  </svg>`;

  await sharp(Buffer.from(ogSvg), { density: 220 })
    .resize(1200, 630)
    .composite([{ input: markPng, left: 140, top: 165 }])
    .png()
    .toFile(path.join(brand, "og-social.png"));
  console.log("✓ brand/og-social.png 1200x630");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
