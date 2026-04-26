import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display login form', async ({ page }) => {
    await page.goto('/');
    
    // Vérifier que le formulaire de login est visible
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/mot de passe|password/i);
    const loginButton = page.getByRole('button', { name: /connexion|login/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/');
    
    const loginButton = page.getByRole('button', { name: /connexion|login/i });
    await loginButton.click();

    // Attendre les messages d'erreur
    await expect(page.locator('text=/email.*requis|email.*required/i')).toBeVisible();
    await expect(page.locator('text=/mot de passe.*requis|password.*required/i')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel(/email/i).fill('invalid@example.com');
    await page.getByLabel(/mot de passe|password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /connexion|login/i }).click();

    // Attendre le message d'erreur
    await expect(page.locator('text=/identifiants.*incorrects|invalid.*credentials/i')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Navigation', () => {
  test('should have accessible main navigation', async ({ page }) => {
    await page.goto('/');
    
    // Vérifier que les éléments de navigation principaux sont présents
    const header = page.locator('header, nav');
    await expect(header).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('should be responsive on mobile', async ({ page }) => {
    // Vérifier sur écran mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();
  });

  test('should be responsive on tablet', async ({ page }) => {
    // Vérifier sur écran tablette
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();
  });

  test('should be responsive on desktop', async ({ page }) => {
    // Vérifier sur écran desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('should load homepage within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    // La page doit charger en moins de 3 secondes
    expect(loadTime).toBeLessThan(3000);
  });

  test('should have no console errors on homepage', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    
    // Filtrer les erreurs ignorables
    const ignorableErrors = errors.filter(
      (e) => !e.includes('ResizeObserver loop limit exceeded')
    );

    expect(ignorableErrors.length).toBe(0);
  });
});

test.describe('SEO & Accessibility', () => {
  test('should have proper page title', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/');
    const h1s = await page.locator('h1').count();
    expect(h1s).toBeGreaterThan(0);
  });

  test('should have alt text on images', async ({ page }) => {
    await page.goto('/');
    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    expect(imagesWithoutAlt).toBe(0);
  });
});