# Contribution

Cette application est métier, financière et multi-tenant. Les changements doivent rester ciblés, testés et documentés.

## Avant de modifier

1. Identifier le domaine : finance, documents, RLS, UX, offline, vitrine/app.
2. Lire la doc correspondante dans `docs/`.
3. Vérifier les fichiers déjà existants avant de créer un nouveau pattern.
4. Ne pas mélanger cleanup, refonte et correction métier dans un même commit.

## Règles strictes

- Pas de commit/push sans validation explicite.
- Pas de migration sans analyse.
- Pas de changement RLS sans test multi-tenant.
- Pas de logique paiement confirmée hors ligne.
- Pas de clé sensible dans le code.
- Pas de QR public vers `app.samaykeur.com`.

## Standards UI

- mobile propre ;
- pas d'overflow horizontal ;
- boutons accessibles ;
- textes lisibles ;
- états loading bornés ;
- empty states utiles ;
- pas de données décoratives trompeuses.

## Standards docs

- docs en UTF-8 ;
- pas de caractères d'encodage cassés dans les textes français ;
- chaque domaine a sa page ;
- les notes obsolètes vont dans `docs/historique`.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

Si vitrine :

```bash
npm run typecheck
npm run build
```

## Tests métier selon domaine

Finance :

- paiement complet ;
- paiement partiel ;
- reliquat ;
- mois soldé.

Documents :

- quittance ;
- contrat ;
- mandat ;
- rapport bailleur ;
- `/verify`.

RBAC :

- compte agence ;
- compte bailleur individuel ;
- rôle limité ;
- accès direct URL.
