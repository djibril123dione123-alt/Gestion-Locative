# Samay Këur - Application SaaS

Samay Këur est l'application connectée de gestion locative pour agences, gestionnaires et bailleurs individuels.

Ce dépôt contient l'app privée cible :

```txt
app.samaykeur.com
```

La vitrine publique est séparée et vit dans le dépôt `SamayKeur.com.git`.

## Séparation des surfaces

```txt
samaykeur.com
-> vitrine publique, pages légales, route /verify

app.samaykeur.com
-> application SaaS connectée, données privées, workflows métier
```

Ne pas mélanger les deux projets.

## Capacités principales

- portefeuille locatif : bailleurs, biens, unités, locataires ;
- contrats, mandats, résiliations ;
- encaissements, paiements partiels, reliquats et impayés ;
- rapports bailleurs/propriétaires ;
- GED, documents PDF et QR de vérification ;
- RBAC, multi-tenant, paramètres, abonnement ;
- mode bailleur individuel avec propriétaire unique interne.

## Documents vérifiables

Les nouveaux QR documentaires doivent pointer vers :

```txt
https://samaykeur.com/verify?token=...&ref=...&type=...
```

La route `/verify` est publique côté vitrine et appelle l'Edge Function Supabase `verify-document`.

## Installation

```bash
cd "C:\Users\DELL\Documents\Samay Keur\App Samay Keur"
npm install
```

Créer un `.env.local` à partir de `.env.example`.

Ne jamais écrire de clé `service_role` dans le frontend.

## Développement

```bash
npm run dev
```

Preview production locale :

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4175
```

## Checks avant push

```bash
npm run typecheck
npm run lint
npm run build
```

Tests disponibles selon le chantier :

```bash
npm run test
npm run test:unit
```

## Variables importantes

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_PUBLIC_VERIFY_BASE_URL=https://samaykeur.com
VITE_APP_URL=https://app.samaykeur.com
VITE_PUBLIC_APP_URL=https://app.samaykeur.com
VITE_MARKETING_URL=https://samaykeur.com
```

Après modification d'une variable `VITE_*`, redeployer l'app.

## Documentation interne

La documentation est organisée par domaine dans [`docs/README.md`](docs/README.md).

Entrées principales :

- état actuel : [`docs/current-state.md`](docs/current-state.md)
- architecture : [`docs/architecture.md`](docs/architecture.md)
- profils adaptatifs : [`docs/adaptive-profiles-phase-0.md`](docs/adaptive-profiles-phase-0.md)
- finance : [`docs/finance-engine.md`](docs/finance-engine.md)
- paiements : [`docs/payments.md`](docs/payments.md)
- GED : [`docs/document-storage.md`](docs/document-storage.md)
- sécurité : [`docs/security.md`](docs/security.md)
- conventions : [`docs/conventions.md`](docs/conventions.md)

## Conventions clés

- afficher les personnes en ordre `Prénom Nom` ;
- utiliser `accountProfile` pour les variantes de compte ;
- ne jamais confirmer un paiement hors ligne ;
- garder les QR publics sur `samaykeur.com/verify` ;
- ne pas commit/push sans validation explicite.

## Licence

Projet privé. Toute utilisation, distribution ou déploiement hors cadre autorisé doit être validé par l'équipe propriétaire.
