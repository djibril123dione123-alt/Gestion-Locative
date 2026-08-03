import { expect, test } from '@playwright/test';

async function openRegistration(page: import('@playwright/test').Page) {
  await page.goto('/#/login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Inscription' }).click();
  await expect(page.getByRole('heading', { name: 'Créer votre espace' })).toBeVisible();
}

test.describe('Création de compte', () => {
  test('signale les informations d’identité manquantes', async ({ page }) => {
    await openRegistration(page);
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.getByRole('alert')).toContainText(/prénom, nom et email/i);
  });

  test('passe à la sécurisation après une identité valide', async ({ page }) => {
    await openRegistration(page);
    await page.getByLabel('Prénom').fill('Awa');
    await page.getByLabel(/^Nom/).fill('Diop');
    await page.getByLabel(/^Email/).fill('awa.diop@example.com');
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.getByRole('textbox', { name: /^Mot de passe/ })).toBeVisible();
    await expect(page.getByLabel('Confirmer le mot de passe')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Créer mon espace' })).toBeDisabled();
  });

  test('présente les engagements juridiques avant la création', async ({ page }) => {
    await openRegistration(page);
    await page.getByLabel('Prénom').fill('Awa');
    await page.getByLabel(/^Nom/).fill('Diop');
    await page.getByLabel(/^Email/).fill('awa.diop@example.com');
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.getByRole('link', { name: /conditions générales/i })).toHaveAttribute('href', /cgu/);
    await expect(page.getByRole('link', { name: /politique de confidentialité/i })).toHaveAttribute('href', /confidentialite/);
    await expect(page.getByRole('checkbox')).not.toBeChecked();
  });

  test('refuse localement des mots de passe incohérents', async ({ page }) => {
    await openRegistration(page);
    await page.getByLabel('Prénom').fill('Awa');
    await page.getByLabel(/^Nom/).fill('Diop');
    await page.getByLabel(/^Email/).fill('awa.diop@example.com');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('textbox', { name: /^Mot de passe/ }).fill('motdepasse1');
    await page.getByLabel('Confirmer le mot de passe').fill('motdepasse2');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Créer mon espace' }).click();

    await expect(page.getByRole('alert')).toContainText(/ne correspondent pas/i);
  });
});
