import { expect, test } from '@playwright/test';

const LOGIN_ROUTE = '/#/login';

test.describe('Authentification', () => {
  test('affiche un formulaire de connexion accessible', async ({ page }) => {
    await page.goto(LOGIN_ROUTE, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await expect(page.getByLabel(/^Email/)).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^Mot de passe/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  });

  test('empêche la soumission native des champs obligatoires vides', async ({ page }) => {
    await page.goto(LOGIN_ROUTE, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByLabel(/^Email/)).toHaveJSProperty('validity.valueMissing', true);
    await expect(page.getByRole('textbox', { name: /^Mot de passe/ })).toHaveJSProperty('validity.valueMissing', true);
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  });

  test('humanise un refus de connexion renvoyé par Auth', async ({ page }) => {
    await page.route('**/auth/v1/token**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      });
    });

    await page.goto(LOGIN_ROUTE, { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/^Email/).fill('invalide@example.com');
    await page.getByRole('textbox', { name: /^Mot de passe/ }).fill('mauvais-mot-de-passe');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByRole('alert')).toContainText(/invalid login credentials|identifiants/i);
  });
});

test.describe('Routes publiques et protégées', () => {
  test('une route métier protégée ne révèle pas son contenu sans session', async ({ page }) => {
    await page.goto('/#/dashboard', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await expect(page.getByLabel(/^Email/)).toBeVisible();
    await expect(page.getByText('Tableau de bord', { exact: true })).toHaveCount(0);
  });

  test('la page tarifs reste publiquement accessible', async ({ page }) => {
    await page.goto('/#/pricing', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/plans/i);
    await expect(page.getByRole('heading', { name: 'Starter' })).toBeVisible();
    await expect(page.getByText('Pro', { exact: true }).first()).toBeVisible();
  });
});

test.describe('Responsive et accessibilité de base', () => {
  for (const viewport of [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablette', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ]) {
    test(`reste exploitable en ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(LOGIN_ROUTE, { waitUntil: 'domcontentloaded' });

      await expect(page.getByLabel(/^Email/)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test('expose un titre, un h1 et des alternatives image', async ({ page }) => {
    await page.goto(LOGIN_ROUTE, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveTitle(/Samay Këur/i);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('img:not([alt])')).toHaveCount(0);
  });

  test('rend le formulaire dans un budget local raisonnable', async ({ page }) => {
    const startedAt = Date.now();
    await page.goto(LOGIN_ROUTE, { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/^Email/).waitFor({ state: 'visible' });

    expect(Date.now() - startedAt).toBeLessThan(10_000);
  });
});
