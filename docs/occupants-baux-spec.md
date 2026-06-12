# CAHIER DES CHARGES OFFICIEL — OCCUPANTS & BAUX

## Samay Këur — Bêta Premium

---

# OBJECTIF

Construire la source de vérité du cycle locatif.

Le chantier Occupants & Baux ne consiste pas à développer :

* un module Locataires ;
* un module Contrats.

Le chantier consiste à construire le domaine métier central reliant :

Occupant → Bail → Occupation → Paiements → Documents → Rapports

Tous les futurs modules financiers et documentaires dépendront de cette couche.

---

# VISION

Une agence doit pouvoir comprendre en moins de 30 secondes :

* qui occupe un bien ;
* quel bail le lie ;
* combien il paie ;
* depuis quand ;
* jusqu'à quand ;
* son historique ;
* son statut actuel.

Sans Excel.

Sans WhatsApp.

Sans perte de contexte.

---

# PRINCIPES PRODUIT

## Source de vérité

Un occupant possède :

* son identité ;
* ses documents ;
* son historique.

Un bail possède :

* ses conditions ;
* ses dates ;
* son statut ;
* son historique.

Les deux doivent être consultables depuis une même expérience métier.

---

## Drawer First

Le Drawer est la fiche principale.

Éviter les changements de page inutiles.

L'utilisateur doit conserver son contexte.

---

## Mobile First

Tous les workflows doivent fonctionner sur smartphone.

Aucun overflow horizontal non contrôlé.

---

## Historique permanent

Jamais de suppression métier.

Toujours :

Actif
↓
Résilié
↓
Archivé

---

# MODÈLE MÉTIER

## Occupant

Informations :

### Identité

* prénom
* nom
* téléphone principal
* téléphone secondaire
* email
* profession

### Adresse

* adresse actuelle

### Documents

* CNI
* Passeport
* autre pièce

### Statut

* actif
* inactif
* archivé

---

## Bail

### Référence

* numéro unique

### Relations

* occupant
* unité
* bien
* bailleur

### Financier

* loyer
* caution
* avance éventuelle

### Durée

* date début
* date fin

### Conditions

* fréquence
* remarques

### Statut

* actif
* expiré
* résilié
* archivé

---

# OCCUPATION DES UNITÉS

La cohérence doit être garantie.

## Création bail

Unité :

Disponible
↓
Occupée

---

## Résiliation

Unité :

Occupée
↓
Disponible

---

## Transfert

Ancienne unité :

Occupée
↓
Disponible

Nouvelle unité :

Disponible
↓
Occupée

---

# LISTE OCCUPANTS & BAUX

Vue principale du domaine.

Colonnes minimales :

* Nom occupant
* Téléphone
* Bien
* Unité
* Référence bail
* Début bail
* Fin bail
* Loyer
* Statut
* Actions

---

# RECHERCHE

Recherche instantanée sur :

* nom
* prénom
* téléphone
* référence bail
* unité

---

# FILTRES

Filtres obligatoires :

* Actifs
* Expirés
* Résiliés
* En renouvellement
* En impayé

---

# DRAWER OCCUPANT & BAIL

Le Drawer devient la fiche métier principale.

---

## Onglet Résumé

### Occupant

* identité
* contacts
* profession

### Bail

* référence
* statut
* dates
* loyer

### Occupation

* bien
* unité
* bailleur

---

## Onglet Paiements

Préparation Finance.

Afficher :

* paiements liés
* statut financier

Lecture seule dans cette phase.

---

## Onglet Documents

Afficher :

* contrat
* pièces jointes
* annexes

Préparer GED.

---

## Onglet Historique

Timeline complète :

* création occupant
* création bail
* modification
* renouvellement
* transfert
* résiliation
* archivage

---

# CRÉATION OCCUPANT

Workflow complet.

Validation :

* données obligatoires
* doublons téléphone
* cohérence informations

---

# CRÉATION BAIL

Workflow complet.

Validation :

* unité disponible
* occupant valide
* dates cohérentes
* montant valide

---

# RENOUVELLEMENT

Workflow dédié.

Le renouvellement :

* conserve l'historique ;
* conserve la traçabilité ;
* crée une nouvelle période de bail.

Interdiction :

modifier simplement la date de fin.

Le renouvellement est un événement métier.

---

# RÉSILIATION

Workflow dédié.

Motifs :

* départ volontaire
* impayé
* fin contrat
* autre

Résultat :

Statut = Résilié

Jamais de suppression.

---

# ARCHIVAGE

Après résiliation :

Résilié
↓
Archivé

L'historique reste consultable.

---

# MODE BAILLEUR INDIVIDUEL

Obligatoire.

Le propriétaire doit pouvoir :

* voir ses occupants ;
* voir ses baux ;
* consulter son historique.

Même moteur métier.

UX simplifiée.

Aucune complexité agence inutile.

---

# SÉCURITÉ

## Multi-tenant

Respect strict :

* organization_id
* agency_id
* RLS

---

## Interdictions

* désactiver RLS
* contourner RLS
* exposer des données d'une autre agence

---

# MOBILE FIRST

Validation obligatoire :

* drawer utilisable
* formulaires utilisables
* tableaux adaptatifs
* actions accessibles

Aucun écran cassé.

---

# CRITÈRES DE VALIDATION BÊTA PREMIUM

## Création

✅ création occupant

✅ création bail

---

## Gestion

✅ modification occupant

✅ modification bail

✅ renouvellement

✅ résiliation

✅ archivage

---

## Consultation

✅ liste

✅ recherche

✅ filtres

✅ drawer métier

---

## Historique

✅ traçabilité complète

---

## Occupation

✅ cohérence unité disponible / occupée

---

## Mobile

✅ responsive

---

## Sécurité

✅ RLS validé

---

## Qualité

✅ typecheck

✅ lint

✅ build

---

# DÉFINITION OFFICIELLE DE TERMINÉ

Le chantier Occupants & Baux est terminé uniquement lorsqu'une agence peut gérer l'entrée, la vie, le renouvellement, la résiliation et l'archivage d'un occupant et de son bail, avec historique complet et sans revenir à Excel.
