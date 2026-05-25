# Deploiement

Samay Këur est deploye sur Vercel pour le frontend et Supabase pour la base, les Edge Functions et le Storage.

## Environnements

- local : developpement et preview.
- staging/beta : validation fonctionnelle.
- production : domaine public.

## Frontend Vercel

Build :

```bash
npm run build
```

Preview locale :

```bash
npm run preview -- --host 127.0.0.1 --port 4175
```

Variables Vercel a verifier :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PUBLIC_APP_URL`
- Sentry/PostHog si actives.

## Supabase

Elements a deployer :

- migrations SQL ;
- Edge Functions ;
- secrets Edge ;
- policies RLS ;
- buckets Storage.

## Ordre recommande

1. Appliquer les migrations.
2. Deployer les Edge Functions.
3. Configurer les secrets.
4. Verifier les buckets et policies.
5. Deployer le frontend.
6. Lancer smoke tests.
7. Verifier monitoring.

## Checks avant production

```bash
npm run typecheck
npm run lint
npm run build
npm run test
```

## Smoke tests

- Login admin.
- Ouverture dashboard.
- Creation paiement test.
- Verification reliquat partiel.
- Generation quittance.
- Scan QR document.
- Upload document GED.
- Test permission agent sans acces.
- Test route interdite.
- Test preview mobile.

## Post-deploy

- verifier Sentry ;
- verifier logs Edge Functions ;
- verifier pending jobs ;
- verifier drift ledger ;
- verifier PayDunya webhook ;
- verifier quotas Storage ;
- verifier que les URLs QR utilisent le domaine production.
