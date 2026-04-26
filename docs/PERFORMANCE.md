# Optimisation de Performance - Samay Këur

## Vue d'ensemble

Cette documentation couvre les stratégies d'optimisation pour la performance et la bande passante de Samay Këur.

## 1. Audit de performance actuel

### Baseline

```bash
# Générer un rapport Lighthouse
npm run dev
# Ouvrir DevTools > Lighthouse > Generate report

# Targets
- Performance: >= 80
- Accessibility: >= 90
- Best Practices: >= 90
- SEO: >= 90
```

## 2. Bundle Size Optimization

### Code Splitting

Le build Vite applique déjà le code splitting automatique. Pour l'optimiser:

```typescript
// ✅ Bon - Lazy load les gros composants
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));

export function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Dashboard />
    </Suspense>
  );
}
```

### Tree-shaking

```bash
# Vérifier que les imports inutilisés sont bien éliminés
npm run build -- --analyze

# Topics courants:
# - Importer uniquement ce qu'on utilise de lodash
# - Utiliser les named imports, pas default
# - Vérifier les dépendances dans package.json
```

### Dépendances lourdes

| Dépendance | Taille | Alternative | Note |
|-----------|--------|-------------|------|
| jsPDF | ~400KB | pdfkit (200KB) | Actuellement nécessaire pour exports |
| Recharts | ~300KB | Victory (250KB) | OK pour graphiques critiques |
| html2canvas | ~200KB | screenshot.js (50KB) | Pour screenshots uniquement |

Stratégie actuelle: Acceptable car chargement différé

## 3. Network Optimization

### Compression

```bash
# Verifier que la compression gzip est activée
curl -I https://samay-keur.vercel.app | grep Content-Encoding
# Doit afficher: Content-Encoding: gzip
```

### Images

```typescript
// ✅ Bon - WebP avec fallback
<picture>
  <source srcSet={imageWebp} type="image/webp" />
  <img src={imagePNG} alt="Description" loading="lazy" />
</picture>

// ❌ Mauvais
<img src={largePNG} alt="Desc" />
```

### Caching Headers

Vercel applique déjà le caching optimal. Vérifier:

```bash
curl -I https://samay-keur.vercel.app
# Doit avoir:
# - Cache-Control: public, max-age=3600
# - ETag: [hash]
```

## 4. Database Query Optimization

### RLS Policy Impact

Les policies RLS peuvent impacter la performance si mal configurées:

```sql
-- ✅ Bon - Index sur les colonnes fréquemment filtrées
CREATE INDEX idx_contracts_agency_id ON contracts(agency_id);

-- ❌ Mauvais - N+1 queries
SELECT * FROM contracts WHERE agency_id = (
  SELECT agency_id FROM user_profiles WHERE id = auth.uid()
);
```

### Connection Pooling

Supabase gère automatiquement le pooling. Pas d'action requise.

## 5. Client-Side Optimization

### React Optimizations

```typescript
// ✅ Bon - Memoize les composants coûteux
import { memo } from 'react';

const TableRow = memo(({ data }) => {
  return <tr>{/* Rendu */}</tr>;
});

// ✅ Bon - useMemo pour les calculs coûteux
const expensiveCalculation = useMemo(() => {
  return data.reduce(/* ... */);
}, [data]);

// ❌ Mauvais - Recalculer à chaque rendu
const result = data.reduce(/* ... */);
```

### Sentry Performance

L'intégration Sentry monitore automatiquement:

- CLS (Cumulative Layout Shift)
- LCP (Largest Contentful Paint)
- FID (First Input Delay)

Vérifier les données dans Sentry > Performance tab

## 6. Build Optimization

### Current Configuration

```typescript
// vite.config.ts
build: {
  outDir: 'dist',
  sourcemap: true,  // Pour Sentry (peut augmenter la taille)
  chunkSizeWarningLimit: 1500,
}
```

### Reducing Sourcemap Size

```typescript
// Pour la production (optionnel)
build: {
  sourcemap: process.env.VITE_ENV === 'production' ? 'hidden-source-map' : true,
}
```

## 7. Runtime Performance

### Lazy Loading Lists

```typescript
// Utiliser react-window pour les grandes listes
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={1000}
  itemSize={35}
>
  {({ index, style }) => (
    <div style={style}>{/* Row */}</div>
  )}
</FixedSizeList>
```

### Debounce Search

```typescript
// Éviter l'appel API à chaque keystroke
const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    searchAPI(query);
  }, 300),
  []
);
```

## 8. Monitoring Performance

### Vercel Analytics

Vérifier dans Vercel Dashboard > Analytics:

- **TTFB** (Time to First Byte): < 200ms
- **FCP** (First Contentful Paint): < 1.8s
- **LCP** (Largest Contentful Paint): < 2.5s
- **CLS** (Cumulative Layout Shift): < 0.1

### Sentry Performance

1. Aller sur Sentry Dashboard
2. Performance > Graphs
3. Vérifier les p95 et p99 latency

### Google Lighthouse CI

Intégrer dans GitHub Actions:

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse
on: [pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: treosh/lighthouse-ci-action@v9
        with:
          uploadArtifacts: true
```

## 9. Specific Performance Issues

### Slow Dashboard Load

1. Vérifier les queries Supabase
2. Implémenter le lazy loading des graphiques
3. Loader skeleton screens pour les données tardives

```typescript
// ✅ Exemple avec Skeleton loading
function Dashboard() {
  const [data, setData] = useState(null);

  return (
    <div>
      {data ? <Chart data={data} /> : <ChartSkeleton />}
    </div>
  );
}
```

### Slow PDF Export

1. Le chargement de jsPDF impacte
2. Implémenter un worker thread:

```typescript
// pdf.worker.ts
export function generatePDF(data) {
  // Travail dans un worker thread, pas le main thread
  return pdfBlob;
}
```

### Memory Leaks

Utiliser React DevTools Profiler:

1. Chrome DevTools > React > Profiler
2. Chercher les components qui ne démont pas correctement
3. S'assurer de cleanup dans useEffect

```typescript
// ✅ Bon - Cleanup
useEffect(() => {
  const subscription = dataStream.subscribe();
  return () => subscription.unsubscribe();
}, []);
```

## 10. Checklist de performance avant déploiement

- [ ] `npm run build` complet < 20s
- [ ] Bundle size < 500KB gzipped
- [ ] Lighthouse Performance >= 80
- [ ] Pas de console errors/warnings
- [ ] `npm audit` 0 critifical vulnerabilities
- [ ] Pas de memory leaks (DevTools Profiler)
- [ ] Image optimisées (WebP + lazy loading)
- [ ] RLS queries avec index appropriés

## Ressources

- [Vite Performance Guide](https://vitejs.dev/guide/features.html)
- [React Performance](https://react.dev/reference/react/memo)
- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [Sentry Performance Monitoring](https://docs.sentry.io/platforms/javascript/performance/)