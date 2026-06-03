# Déploiement

Samay Këur est déployé avec deux projets Vercel distincts et un backend Supabase commun.

## Projets

| Projet | Dépôt | Domaine |
|---|---|---|
| App SaaS | `app.SamayKeur.com.git` | `app.samaykeur.com` |
| Vitrine | `SamayKeur.com.git` | `samaykeur.com` |

## Déploiement app

Commandes locales :

```bash
cd "C:\Users\DELL\Documents\Samay Keur\App Samay Keur"
npm run typecheck
npm run lint
npm run build
```

Preview :

```bash
npm run preview -- --host 127.0.0.1 --port 4175
```

Variables app importantes :

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_PUBLIC_VERIFY_BASE_URL=https://samaykeur.com
VITE_APP_URL=https://app.samaykeur.com
VITE_PUBLIC_APP_URL=https://app.samaykeur.com
VITE_MARKETING_URL=https://samaykeur.com
```

Après changement d'une variable `VITE_*`, redeployer l'app.

## Déploiement vitrine

La vitrine est dans le projet séparé :

```txt
C:\Users\DELL\Documents\Samay Keur\Vitrine Samay Keur\apps\web
```

Checks vitrine :

```bash
npm run typecheck
npm run build
```

Routes publiques à vérifier :

- `/`
- `/cgu`
- `/mentions-legales`
- `/confidentialite`
- `/verify`
- `/verify?ref=test&type=quittance`

## Supabase

Déployer séparément :

- migrations SQL ;
- Edge Functions ;
- secrets ;
- buckets Storage ;
- policies RLS.

Ne pas lancer une migration sans analyse d'impact.

## Smoke tests app

- login ;
- dashboard ;
- paiement complet ;
- paiement partiel ;
- génération quittance ;
- scan QR ;
- rapport bailleur ;
- accès bailleur individuel ;
- accès agence ;
- mobile sans overflow horizontal.

## Smoke tests vitrine

- CTA signup/login ;
- pages légales ;
- route `/verify` ;
- appel `verify-document` ;
- responsive mobile ;
- absence de 404 assets.
