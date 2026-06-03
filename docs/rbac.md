# RBAC et multi-tenant

RBAC définit ce qu'un utilisateur peut faire. Le type de compte définit la nature de l'espace. Les deux ne doivent pas être confondus.

## Rôles

Rôles courants :

- `super_admin`
- `admin`
- `agent`
- `comptable`
- `bailleur`
- `viewer`

## Type de compte

Phase 1 :

- agence par défaut ;
- bailleur individuel si `agencies.is_bailleur_account = true`.

Phase suivante :

- `individual_landlord`
- `multi_property_landlord`
- `property_manager`
- `agency`
- `group`

## Rôle effectif

Un bailleur individuel propriétaire de son espace peut avoir une expérience admin côté UI, même si le rôle métier `bailleur` existe pour d'autres usages.

Les composants doivent utiliser :

- `getEffectiveRoleForAccount()`
- `canAccessAccountPage()`
- `accountProfile.features`

## Routes masquées

Pour bailleur individuel :

- Bailleurs ;
- Mandats ;
- Commissions ;
- Équipe avancée ;
- Audit complet.

Accès direct URL : afficher une page de module réservé plutôt qu'une page cassée.

## Multi-tenant

Toute donnée métier doit être rattachée à une agence/organisation. Les policies doivent empêcher :

- lecture inter-agence ;
- écriture hors agence ;
- élévation de rôle client-side ;
- accès aux documents privés d'un autre tenant.
