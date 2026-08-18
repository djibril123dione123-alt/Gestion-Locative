# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentification >> empêche la soumission native des champs obligatoires vides
- Location: tests\auth.spec.ts:15:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:5000/#/login", waiting until "domcontentloaded"

```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | const LOGIN_ROUTE = '/#/login';
  4  | 
  5  | test.describe('Authentification', () => {
  6  |   test('affiche un formulaire de connexion accessible', async ({ page }) => {
  7  |     await page.goto(LOGIN_ROUTE, { waitUntil: 'domcontentloaded' });
  8  | 
  9  |     await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  10 |     await expect(page.getByLabel(/^Email/)).toBeVisible();
  11 |     await expect(page.getByRole('textbox', { name: /^Mot de passe/ })).toBeVisible();
  12 |     await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  13 |   });
  14 | 
  15 |   test('empêche la soumission native des champs obligatoires vides', async ({ page }) => {
> 16 |     await page.goto(LOGIN_ROUTE, { waitUntil: 'domcontentloaded' });
     |                ^ Error: page.goto: Test timeout of 30000ms exceeded.
  17 |     await page.getByRole('button', { name: 'Se connecter' }).click();
  18 | 
  19 |     await expect(page.getByLabel(/^Email/)).toHaveJSProperty('validity.valueMissing', true);
  20 |     await expect(page.getByRole('textbox', { name: /^Mot de passe/ })).toHaveJSProperty('validity.valueMissing', true);
  21 |     await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  22 |   });
  23 | 
  24 |   test('humanise un refus de connexion renvoyé par Auth', async ({ page }) => {
  25 |     await page.route('**/auth/v1/token**', async (route) => {
  26 |       await route.fulfill({
  27 |         status: 400,
  28 |         contentType: 'application/json',
  29 |         body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
  30 |       });
  31 |     });
  32 | 
  33 |     await page.goto(LOGIN_ROUTE, { waitUntil: 'domcontentloaded' });
  34 |     await page.getByLabel(/^Email/).fill('invalide@example.com');
  35 |     await page.getByRole('textbox', { name: /^Mot de passe/ }).fill('mauvais-mot-de-passe');
  36 |     await page.getByRole('button', { name: 'Se connecter' }).click();
  37 | 
  38 |     await expect(page.getByRole('alert')).toContainText(/invalid login credentials|identifiants/i);
  39 |   });
  40 | });
  41 | 
  42 | test.describe('Routes publiques et protégées', () => {
  43 |   test('une route métier protégée ne révèle pas son contenu sans session', async ({ page }) => {
  44 |     await page.goto('/#/dashboard', { waitUntil: 'domcontentloaded' });
  45 | 
  46 |     await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  47 |     await expect(page.getByLabel(/^Email/)).toBeVisible();
  48 |     await expect(page.getByText('Tableau de bord', { exact: true })).toHaveCount(0);
  49 |   });
  50 | 
  51 |   test('la page tarifs reste publiquement accessible', async ({ page }) => {
  52 |     await page.goto('/#/pricing', { waitUntil: 'domcontentloaded' });
  53 | 
  54 |     await expect(page.getByRole('heading', { level: 1 })).toContainText(/plan/i);
  55 |     await expect(page.getByRole('heading', { name: 'Essentiel', exact: true })).toBeVisible();
  56 |     await expect(page.getByText('Pro', { exact: true }).first()).toBeVisible();
  57 |   });
  58 | });
  59 | 
  60 | test.describe('Responsive et accessibilité de base', () => {
  61 |   for (const viewport of [
  62 |     { name: 'mobile', width: 375, height: 667 },
  63 |     { name: 'tablette', width: 768, height: 1024 },
  64 |     { name: 'desktop', width: 1440, height: 900 },
  65 |   ]) {
  66 |     test(`reste exploitable en ${viewport.name}`, async ({ page }) => {
  67 |       await page.setViewportSize({ width: viewport.width, height: viewport.height });
  68 |       await page.goto(LOGIN_ROUTE, { waitUntil: 'domcontentloaded' });
  69 | 
  70 |       await expect(page.getByLabel(/^Email/)).toBeVisible();
  71 |       const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  72 |       expect(overflow).toBeLessThanOrEqual(1);
  73 |     });
  74 |   }
  75 | 
  76 |   test('expose un titre, un h1 et des alternatives image', async ({ page }) => {
  77 |     await page.goto(LOGIN_ROUTE, { waitUntil: 'domcontentloaded' });
  78 | 
  79 |     await expect(page).toHaveTitle(/Samay Këur/i);
  80 |     await expect(page.locator('h1')).toHaveCount(1);
  81 |     await expect(page.locator('img:not([alt])')).toHaveCount(0);
  82 |   });
  83 | 
  84 |   test('rend le formulaire dans un budget local raisonnable', async ({ page }) => {
  85 |     const startedAt = Date.now();
  86 |     await page.goto(LOGIN_ROUTE, { waitUntil: 'domcontentloaded' });
  87 |     await page.getByLabel(/^Email/).waitFor({ state: 'visible' });
  88 | 
  89 |     expect(Date.now() - startedAt).toBeLessThan(10_000);
  90 |   });
  91 | });
  92 | 
```