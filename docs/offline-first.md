# Offline-first

Objectif : rendre l'app utilisable avec une connexion lente, instable ou absente, sans mentir sur les données ni confirmer des actions sensibles hors ligne.

## Comportement cible

- garder l'utilisateur dans l'app si sa session était valide ;
- afficher les dernières données connues si disponibles ;
- afficher `Données indisponibles hors connexion` si aucun cache n'existe ;
- remplacer les skeleton infinis par des états bornés ;
- rendre les bandeaux réseau fermables ;
- bloquer proprement les paiements et documents financiers hors ligne ;
- rafraîchir à la reconnexion.

## Éléments à auditer régulièrement

| Élément | Attendu |
|---|---|
| `AuthContext` | ne pas rediriger vers Welcome uniquement parce que le réseau est tombé |
| Cache local | scope par `user_id` et `agency_id` |
| Network banner | fermable, clair, non bloquant |
| Pages métier | pas de compteur à `0` si les données n'ont pas chargé |
| Actions sensibles | pas de validation hors ligne |

## Règle finance

Les paiements, quittances et écritures financières ne doivent pas être rejoués automatiquement sans validation serveur claire et idempotente.

## UX attendue

États visibles :

- en ligne ;
- connexion lente ;
- hors ligne avec cache ;
- hors ligne sans cache ;
- erreur serveur ;
- reconnexion et rafraîchissement.

Chaque page critique doit proposer :

- dernière mise à jour ;
- bouton Réessayer ;
- message clair ;
- données cache si disponibles.

## Pages prioritaires

- Dashboard ;
- Bailleurs ;
- Contrats ;
- Encaissements ;
- Loyers impayés ;
- Documents ;
- Rapports bailleurs.

## Limites

L'offline-first est un chantier de résilience. Tant que toutes les mutations n'ont pas une stratégie d'idempotence, l'offline doit rester lecture/cache + blocage propre des écritures sensibles.
