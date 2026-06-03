# Paiements

Cette page décrit les règles opérationnelles des encaissements.

## Sélecteur de mois

Le mois concerné doit être basé sur l'état réel du contrat :

- mois soldé : non sélectionnable ;
- mois partiel : sélectionnable avec reliquat visible ;
- mois futur : sélectionnable pour avance ;
- mois hors période de contrat : masqué ou bloqué.

## Paiement partiel

Document attendu :

- loyer total du mois ;
- paiements précédents ;
- nouveau paiement ;
- total payé à date ;
- reliquat ;
- statut `Partiel` ou `Soldé`.

## Protection anti-doublon

Un paiement sur un mois déjà soldé doit être refusé sauf workflow explicite de correction.

Le message utilisateur doit expliquer :

- le mois est déjà payé ;
- la référence du paiement existant si disponible ;
- l'action recommandée.

## Offline

Hors ligne :

- ne pas confirmer un paiement ;
- ne pas générer une quittance comme si le serveur avait validé ;
- afficher un message clair ;
- garder le formulaire si possible.

## Tests minimum

- paiement complet ;
- paiement partiel ;
- paiement de reliquat ;
- mois soldé ;
- mois futur ;
- génération quittance ;
- rapport bailleur ;
- mode agence ;
- mode bailleur individuel.
