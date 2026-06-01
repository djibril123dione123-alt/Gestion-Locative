let routePreloadStarted = false;

const criticalRouteImports = [
  () => import('../pages/Dashboard'),
  () => import('../pages/Patrimoine'),
  () => import('../pages/Immeubles'),
  () => import('../pages/Unites'),
  () => import('../pages/Locataires'),
  () => import('../pages/Bailleurs'),
  () => import('../pages/Contrats'),
  () => import('../pages/Encaissements'),
  () => import('../pages/Paiements'),
  () => import('../pages/LoyersImpayes'),
  () => import('../pages/Documents'),
  () => import('../pages/Analyses'),
  () => import('../pages/TableauDeBordFinancierGlobal'),
  () => import('../pages/Depenses'),
  () => import('../pages/ParametresHub'),
  () => import('../pages/Parametres'),
  () => import('../pages/Abonnement'),
  () => import('../pages/Equipe'),
  () => import('../pages/Notifications'),
];

export function warmOfflineRouteCache() {
  if (routePreloadStarted || !navigator.onLine) return;
  routePreloadStarted = true;

  const run = async () => {
    await Promise.allSettled(criticalRouteImports.map((loadRoute) => loadRoute()));
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      void run();
    }, { timeout: 8_000 });
    return;
  }

  globalThis.setTimeout(() => {
    void run();
  }, 1_500);
}
