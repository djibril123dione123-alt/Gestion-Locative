# Finance engine

Le moteur financier couvre loyers, paiements, reliquats, impayés, commissions, revenus propriétaires et rapports.

## Invariants

- Ne jamais créer un doublon silencieux sur un mois soldé.
- Ne jamais afficher `0` comme donnée réelle si la donnée n'a pas chargé.
- Ne jamais confirmer un paiement si l'écriture réseau ou serveur a échoué.
- Ne jamais déduire une commission agence pour un bailleur individuel.
- Ne jamais modifier le ledger par une correction UI.

## Paiements

Un paiement doit connaître :

- contrat ;
- mois concerné ;
- loyer attendu ;
- paiements précédents du même mois ;
- nouveau montant encaissé ;
- total payé à date ;
- reliquat restant ;
- statut réel.

Statuts attendus :

- `Partiel` si total payé < loyer total ;
- `Soldé` si total payé >= loyer total ;
- `Impayé` si aucun paiement et échéance dépassée.

## Commissions

Mode agence :

- commission visible ;
- net bailleur/propriétaire calculé après commission ;
- rapports bailleurs conservent les lignes agence.

Mode bailleur individuel :

- commission masquée ;
- net affiché comme revenu propriétaire ;
- aucun mandat de gestion obligatoire.

## Rapports financiers

Les rapports doivent distinguer :

- montant brut encaissé ;
- reliquats ;
- impayés ;
- commissions agence si applicables ;
- revenus nets propriétaire ;
- évolution mensuelle.

## Risques critiques

- régression des paiements partiels ;
- confusion quittance/facture ;
- document indiquant `Soldé` sans historique des paiements ;
- cache offline affichant `0` comme vérité.
