# Conventions de code — Samay Këur

## Règles générales

- **Jamais de `any`** dans les modules financiers (`paiementService`, `commissionService`, `paiementApi`).
- **Zéro fallback silencieux** sur les calculs d'argent — lever une erreur typée explicite.
- **Tests obligatoires** pour tout nouveau service dans `src/services/domain/`.
- **Fichiers < 400 lignes** — au-delà, extraire des composants ou des helpers.

## Structure des fichiers

```
src/
├── components/        Composants React réutilisables
│   ├── ui/            Composants génériques (Button, Modal, Table…)
│   └── <feature>/     Composants spécifiques à un domaine (paiements/, …)
├── contexts/          Contextes React globaux (Auth uniquement)
├── hooks/             Hooks React custom
├── lib/               Utilitaires techniques (supabase, sentry, formatters…)
├── pages/             Pages = orchestrateurs (thin, < 400 lignes)
├── repositories/      Accès données Supabase (requêtes SQL uniquement)
├── services/
│   ├── api/           Clients Edge Functions
│   └── domain/        Logique métier pure (zéro side-effect)
└── types/             Types TypeScript partagés (source de vérité)
```

## Types

- **Source de vérité unique** : `src/types/database.ts` pour `UserProfile`, `Agency`, etc.
- Ne jamais redéfinir un type déjà dans `types/` dans un autre fichier.
- Les types de jointure Supabase (`PaiementContrats`, etc.) vivent dans `src/components/<feature>/` si locaux, ou dans `src/types/` si partagés.

## Services domain

- **Fonctions pures uniquement** — pas d'import Supabase, pas d'appels réseau.
- Erreurs typées avec `code` readonly : `PaiementValidationError`, `CommissionRequiredError`, etc.
- Chaque service a ses tests dans `__tests__/<service>.test.ts`.

## Repositories

- **Un repository = une table** : `paiementsRepository.ts` ne touche qu'à `paiements`.
- Toujours filtrer par `agency_id` dans chaque requête (double sécurité avec RLS).
- Pas de logique métier — uniquement des `select/insert/update/delete`.

## Mutations financières

- **Paiements → Edge Functions uniquement** (`createPaiementViaEdge`, etc.) — jamais d'insert direct dans la table `paiements`.
- Le sync offline doit aussi passer par les Edge Functions (voir `offlineQueue.ts`).
- Toujours vérifier `commission > 0` avant de calculer les parts.

## Nommage

| Élément | Convention | Exemple |
|---------|-----------|---------|
| Composants React | PascalCase | `PaiementFormModal` |
| Hooks | camelCase + `use` | `useOfflineSync` |
| Services/utils | camelCase | `buildPaiementPayload` |
| Types/interfaces | PascalCase | `PaiementRow` |
| Constantes | UPPER_SNAKE | `MAX_RETRIES` |
| Fichiers composants | PascalCase | `KpiCard.tsx` |
| Fichiers utils | camelCase | `paiementTypes.ts` |

## Git

- **1 commit = 1 intention claire** (pas de "fix stuff" ou "wip").
- Pas de migration SQL modifiée après son premier déploiement — créer une nouvelle migration.
- Les migrations sont **idempotentes** : utiliser `IF NOT EXISTS`, `IF EXISTS`, `DROP … IF EXISTS`.
