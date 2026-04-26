# Tests E2E avec Playwright

## Vue d'ensemble

Playwright est utilisé pour les tests E2E (End-to-End) de l'application Samay Këur. Ces tests automatisent:

- Vérification des flux utilisateur critiques
- Tests de responsivité (mobile, tablette, desktop)
- Tests de performance et accessibilité
- Validation des fonctionnalités principales

## Installation

Playwright a été installé via:
```bash
npm install -D @playwright/test
```

## Structure des tests

```
tests/
├── auth.spec.ts          # Tests d'authentification et responsivité
└── user-flows.spec.ts    # Tests des flux utilisateur critiques
```

## Exécution des tests

### Lancer tous les tests
```bash
npm test
```

### Lancer les tests en mode interactif (headed)
```bash
npm run test:headed
```

### Lancer les tests avec l'interface Playwright
```bash
npm run test:ui
```

### Déboguer un test spécifique
```bash
npm run test:debug -- tests/auth.spec.ts
```

### Lancer sur un navigateur spécifique
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
npx playwright test --project="Mobile Chrome"
```

## Configuration

Le fichier `playwright.config.ts` configure:

- **Répertoire des tests**: `tests/`
- **Navigateurs testés**: Chromium, Firefox, WebKit + mobiles
- **Base URL**: `http://localhost:5000` (modifiable via `PLAYWRIGHT_BASE_URL`)
- **Rapports**: HTML (consultable avec `npx playwright show-report`)
- **Dev server automatique**: Vite démarre automatiquement sur le port 5000

## Écrire des tests

### Structure de base

```typescript
import { test, expect } from '@playwright/test';

test('should do something', async ({ page }) => {
  await page.goto('/');
  
  // Vos assertions
  await expect(page).toHaveTitle('Page Title');
});
```

### Sélecteurs recommandés (par ordre de préférence)

1. **Accessible names** (pour l'a11y):
   ```typescript
   page.getByRole('button', { name: /submit/i })
   page.getByLabel(/email/i)
   page.getByPlaceholder(/search/i)
   ```

2. **Data attributes** (les plus stables):
   ```typescript
   page.locator('[data-testid="login-button"]')
   ```

3. **CSS/XPath** (à éviter):
   ```typescript
   page.locator('.btn-primary') // risqué
   ```

### Bonnes pratiques

1. **Utiliser des assertions explicites**:
   ```typescript
   // ✅ Bon
   await expect(page).toHaveTitle('Dashboard');
   
   // ❌ Mauvais
   const title = await page.title();
   if (title !== 'Dashboard') throw Error();
   ```

2. **Attendre les éléments**:
   ```typescript
   // ✅ Bon
   await expect(button).toBeVisible();
   
   // ❌ Mauvais
   await page.click('button'); // Peut échouer si pas visible
   ```

3. **Utiliser les bons timeouts**:
   ```typescript
   // Pour les API calls qui peuvent être lentes
   await expect(element).toBeVisible({ timeout: 5000 });
   ```

### Exemple de test complet

```typescript
test('should login successfully', async ({ page }) => {
  // Naviguer
  await page.goto('/');

  // Remplir le formulaire
  await page.getByLabel(/email/i).fill('user@example.com');
  await page.getByLabel(/password/i).fill('password123');

  // Soumettre
  await page.getByRole('button', { name: /login/i }).click();

  // Vérifier la redirection
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('text=Welcome')).toBeVisible();
});
```

## Intégration CI/CD

Dans `.github/workflows/ci.yml`, ajoutez:

```yaml
- name: Run E2E tests
  run: npm test
  if: github.event_name == 'pull_request'
```

## Dépannage

### Les tests échouent localement mais passent en CI

1. Vérifier que le dev server peut être lancé: `npm run dev`
2. Vérifier que le port 5000 n'est pas occupé
3. Lancer les tests en mode headed pour voir le problème: `npm run test:headed`

### Le dev server met trop longtemps à démarrer

Augmenter le timeout dans `playwright.config.ts`:

```typescript
webServer: {
  timeout: 120000, // 2 minutes au lieu de 1
  ...
}
```

### Tests instables (flaky)

- Utiliser `waitForLoadState('networkidle')` pour les pages complexes
- Augmenter les timeouts pour les interactions réseau
- Éviter les `waitForTimeout()` - préférer les locateurs

### Déboguer avec les traces

```typescript
test.only('debug test', async ({ page }) => {
  await page.context().tracing.start({ screenshots: true, snapshots: true });
  
  // Votre test
  
  await page.context().tracing.stop({ path: 'trace.zip' });
});

// Alors visualiser: npx playwright show-trace trace.zip
```

## Ressources

- [Documentation Playwright](https://playwright.dev)
- [Best practices](https://playwright.dev/docs/best-practices)
- [Locators](https://playwright.dev/docs/locators)
- [Debugging](https://playwright.dev/docs/debug)