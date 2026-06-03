# Sécurité

La sécurité de Samay Këur repose sur l'isolation multi-tenant, Supabase Auth, RLS, RBAC et une séparation stricte des surfaces publiques/privées.

## Principes

- Aucune clé `service_role` dans le frontend.
- Les données privées restent sur `app.samaykeur.com`.
- La vitrine publique n'affiche que des informations non sensibles.
- Les routes métier exigent une session valide et une agence autorisée.
- Les actions sensibles passent par une Edge Function, une RPC ou une policy vérifiée.

## RLS et multi-tenant

Les tables métier doivent être filtrées par :

- `agency_id` ;
- relation membre/agence ;
- rôle et permissions effectives quand nécessaire.

Les anciens comptes restent en fallback agence pour éviter une rupture de droits.

## Vérification documentaire publique

`samaykeur.com/verify` ne doit afficher que :

- statut ;
- type ;
- référence ;
- organisation émettrice si autorisée ;
- date de génération/vérification si disponible.

À ne pas exposer :

- coordonnées privées ;
- téléphone ;
- email ;
- montants sensibles si non nécessaires ;
- document complet ;
- URL de stockage privée ;
- détails internes d'erreur.

## Auth et CGU

L'inscription doit collecter l'acceptation des CGU/confidentialité quand le formulaire réel le permet :

- `accepted_terms_at`
- `accepted_privacy_at`
- `terms_version`
- `privacy_version`

Les colonnes doivent rester compatibles avec les anciens comptes.

## Checklist avant changement sensible

- vérifier RLS ;
- tester compte agence et bailleur individuel ;
- vérifier accès direct URL ;
- vérifier absence de fuite de données dans console/logs ;
- lancer `npm run typecheck`, `npm run lint`, `npm run build`.
