# Adaptabilité multi-profils

Objectif : garder un seul socle technique, mais adapter l'expérience selon le type de compte, le rôle, le plan, le mode documentaire et les modules.

## Notions à ne pas confondre

| Notion | Exemple | Rôle |
|---|---|---|
| Type de compte | agence, bailleur individuel, gestionnaire | Nature de l'organisation |
| Rôle utilisateur | admin, agent, comptable, bailleur | Permissions dans l'espace |
| Plan | Starter, Pro, Business, Enterprise | Limites commerciales |
| Mode documentaire | simple, professionnel, juridique | Niveau des documents |
| Modules | mandats, commissions, équipe, audit | Fonctionnalités visibles |

## Phase 1 actuelle

Source de vérité :

```txt
agencies.is_bailleur_account
```

Règles :

- `true` : bailleur individuel ;
- `false`, `null` ou agence absente : expérience agence par défaut ;
- aucun composant produit ne doit lire ce champ directement hors helpers centraux.

## Helpers attendus

- `accountProfile`
- `getAccountPageLabel()`
- `canAccessAccountPage()`
- `getEffectiveRoleForAccount()`
- labels et features centralisés.

## Bailleur individuel

À masquer :

- Bailleurs ;
- Mandats ;
- Commissions agence ;
- Équipe avancée si non pertinente ;
- logique mandataire.

À afficher :

- Vue d'ensemble ;
- Mes biens ;
- Mes locataires ;
- Mes loyers ;
- Mes documents ;
- Mes rapports ;
- Mon compte.

## Auto-sélection bailleur

Pour un compte bailleur individuel :

- le propriétaire du compte est le bailleur unique ;
- les formulaires doivent auto-renseigner le `bailleur_id` interne ;
- aucun select bailleur ne doit bloquer la création de biens, contrats, paiements ou rapports.

## Phase 2 prévue

Introduire progressivement :

```txt
organization_type
document_mode
enabled_modules
```

Fallback obligatoire pour les anciens comptes : `agency`.
