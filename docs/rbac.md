# RBAC et multi-tenant

Le RBAC de Samay Keur combine roles globaux, permissions par page et checks serveur.

## Roles

- `super_admin` : console globale et operations plateforme.
- `admin` : administration d'agence.
- `agent` : operations locatives.
- `comptable` : finance, encaissements, reporting.
- `bailleur` : acces proprietaire limite.

## Niveaux de permission

- `none`
- `read`
- `write`
- `admin`

Actions possibles :

- `create`
- `update`
- `delete`
- `export`
- `manage`

## Modele

```mermaid
flowchart TB
  Role["role utilisateur"] --> Default["permissions par defaut"]
  Override["user_page_permissions"] --> Effective["permissions effectives"]
  Default --> Effective
  Effective --> Sidebar["sidebar"]
  Effective --> Routes["routes"]
  Effective --> Buttons["boutons/actions"]
  Effective --> Edge["fn_user_can cote serveur"]
```

## Frontend

Le frontend applique les permissions pour :

- masquer les pages interdites ;
- rendre certaines vues lecture seule ;
- retirer les boutons interdits ;
- proteger les routes ;
- adapter la navigation mobile.

Ces protections ameliorent l'UX mais ne suffisent pas.

## Backend

Les actions sensibles doivent verifier :

- utilisateur authentifie ;
- profil existant ;
- agence valide ;
- permission via `fn_user_can()` ;
- RLS sur la table cible.

## Multi-tenant

Regle : une requete doit toujours etre bornee par agence.

Exemples :

- `agency_id = profile.agency_id`
- chemin Storage `agencies/{agency_id}/...`
- permissions modifiables uniquement par admin de la meme agence.

## Checklist nouveau module

- Ajouter la page dans le catalogue permissions.
- Definir permission par defaut par role.
- Adapter sidebar et bottom nav.
- Proteger route.
- Masquer actions interdites.
- Ajouter check serveur si action sensible.
- Verifier RLS.
