# Clôture de compte et conservation des données

## Objet

La clôture d'une organisation révoque son accès à Samay Këur sans supprimer les
preuves financières, contractuelles, documentaires ou d'audit. Le flux officiel
est l'Edge Function `close-agency-account`, appelée par un super-administrateur.
L'ancien RPC `delete_agency_cascade` est révoqué pour tous les rôles.

## Données conservées

- agences clôturées et motif de clôture ;
- contrats, paiements, dépenses et écritures du ledger ;
- snapshots financiers officiels ;
- documents générés, registre documentaire et références QR révoquées ;
- journaux d'audit et preuves de clôture ;
- données métier nécessaires à la restitution et à la justification des montants.

Ces données ne sont ni réactivées ni purgées automatiquement. Leur durée légale
de conservation doit être validée par le conseil juridique et le référent données
personnelles au Sénégal avant la bêta payante.

## Données révoquées ou supprimées

- sessions et accès des utilisateurs de l'organisation ;
- permissions par page et notifications courantes ;
- invitations en attente ;
- abonnement actif ;
- fichiers d'identité visuelle dans `agency-assets/<agency_id>`.

Les PDF, pièces financières, contrats et justificatifs ne doivent jamais être
placés dans `agency-assets`; ils restent dans leurs buckets documentaires privés.

## Procédure normale

1. Depuis la console propriétaire, ouvrir la fiche organisation.
2. Vérifier l'identité, le plan, les utilisateurs et les volumes.
3. Saisir un motif explicite d'au moins 12 caractères et confirmer le nom.
4. La commande SQL verrouille l'organisation, crée un rapport de clôture, annule
   l'abonnement, détache les utilisateurs et révoque les QR.
5. L'Edge Function bannit les comptes Auth et supprime les seuls assets d'identité.
6. Le rapport passe à `completed` ou `partial` selon les nettoyages externes.

## Reprise d'une clôture partielle

Une clôture `partial` signifie que les accès SQL sont déjà fermés mais qu'un
nettoyage Auth ou Storage a échoué. Ne jamais relancer l'ancien RPC. Examiner
`samay_admin.account_closure_reports.auth_cleanup` et `storage_cleanup`, corriger
la cause, puis reprendre uniquement l'étape externe avec un opérateur autorisé.

## Contrôles après clôture

```sql
select id, name, status, closed_at, closure_report_id
from public.agencies where id = :agency_id;

select id, agency_id, actif
from public.user_profiles where id = any(:revoked_user_ids);

select status, current_period_end
from public.subscriptions where agency_id = :agency_id;

select count(*) from public.paiements where agency_id = :agency_id;
select count(*) from public.contrats where agency_id = :agency_id;
select count(*) from public.financial_document_snapshots where agency_id = :agency_id;
```

Attendu: agence `cancelled`, utilisateurs inactifs et détachés, abonnement annulé,
comptages financiers et documentaires inchangés.

## Restauration et obligations

La clôture n'est pas une restauration. Une réouverture exige une procédure dédiée,
une validation métier et un audit; elle ne doit pas être obtenue par une mise à jour
manuelle du statut. L'effacement définitif après expiration de la conservation est
hors de ce flux et reste **non prouvé** tant qu'une politique juridique approuvée,
un export de restitution et un test de restauration n'ont pas été exécutés.
