# Samay Këur — Prompts Finance Locative post-récupération

Version mise à jour après l’incident de récupération.
Objectif : reprendre le chantier Finance sans gros prompt, sans action destructrice, et sans perdre l’état récupéré.

---

## 0. Bloc sécurité obligatoire à coller au début de chaque prompt

```txt
Tu travailles sur Samay Këur.

CONTEXTE CRITIQUE :
Il y a eu un écrasement destructeur de fichiers locaux non commités.
À partir de maintenant, aucune action risquée n’est autorisée.
Tu dois travailler par patch minimal, fichier par fichier.

INTERDICTIONS ABSOLUES :
- aucun git checkout ;
- aucun git restore ;
- aucun git reset ;
- aucun git clean ;
- aucun git stash ;
- aucun commit ;
- aucun push ;
- aucun script de reconstruction global ;
- aucun remplacement complet de fichier ;
- aucun formatage automatique global ;
- aucun npm run lint -- --fix ;
- aucune modification d’un fichier non explicitement demandé.

Commandes git autorisées seulement :
- git status --short
- git diff --stat
- git diff --check

Avant toute modification :
1. Lire les fichiers concernés.
2. Expliquer brièvement ce qui va être modifié.
3. Ne modifier que les fichiers explicitement autorisés dans le prompt.

À la fin :
- npm run typecheck
- npm run lint
- npm run build
- git diff --check
- git diff --stat

Ne fais pas de commit.
Ne fais pas de push.
```

---

## 1. Prompt — État des lieux sans modification

```txt
Tu travailles sur Samay Këur.

CONTEXTE CRITIQUE :
Le chantier Finance vient d’être partiellement récupéré après écrasement local.
Je veux un état des lieux sans aucune modification.

INTERDICTIONS ABSOLUES :
- aucun git checkout ;
- aucun git restore ;
- aucun git reset ;
- aucun git clean ;
- aucun git stash ;
- aucun commit ;
- aucun push ;
- aucun script de reconstruction global ;
- aucun remplacement complet de fichier ;
- aucune modification de fichier.

Fichiers à inspecter seulement :
- src/pages/Paiements.tsx
- src/pages/LoyersImpayes.tsx
- src/pages/Depenses.tsx
- src/components/ui/Table.tsx
- src/components/ui/MetricCard.tsx
- src/components/ui/MoneyText.tsx
- src/pages/Bailleurs.tsx
- src/pages/Patrimoine.tsx

Objectif :
Me donner un rapport court et fiable sur :
1. Paiements reçus : état actuel, composants utilisés, risques visibles.
2. Créances / Loyers impayés : ce qui manque par rapport au modèle Finance premium.
3. Dépenses : ce qui manque par rapport au modèle Finance premium.
4. Les fichiers actuellement modifiés selon git status.
5. Les erreurs éventuelles de typecheck/lint/build.

Commandes autorisées :
- git status --short
- npm run typecheck
- npm run lint
- npm run build
- git diff --check
- git diff --stat

Ne modifie rien.
```

---

## 2. Prompt — Wording, navigation et Page Shell Finance

```txt
[COLLER ICI LE BLOC 0 — SÉCURITÉ OBLIGATOIRE]

Objectif :
Restaurer la structure premium des pages Finance sans toucher aux tables, drawers, wizards ou logique serveur.

Fichiers autorisés :
- src/pages/Paiements.tsx
- src/pages/LoyersImpayes.tsx
- éventuellement le fichier de navigation/sidebar si le libellé est défini ailleurs

À faire :

1. Renommer partout côté UI :
- “Loyers impayés” devient “Créances à recouvrer”.

Cela concerne :
- titre de page ;
- onglet secondaire ;
- sous-menu sidebar ;
- aria-labels visibles si besoin.

2. Paiements reçus :
Conserver le header premium actuel s’il est déjà bon :
- surtitre : ENCAISSEMENT & FINANCE
- titre serif : Paiements reçus
- sous-titre : Suivez les encaissements validés, paiements partiels, avances et quittances générées.
- CTA principal : Nouveau paiement.

Supprimer définitivement :
- Exporter ;
- Recharger ;
- Actualiser ;
- Export PDF.

Aucun bouton export ne doit rester dans le header.

3. Créances à recouvrer :
Refaire le header au même niveau que Paiements reçus :
- surtitre : ENCAISSEMENT & FINANCE
- titre serif : Créances à recouvrer
- sous-titre : Suivez les échéances ouvertes, retards, paiements partiels et restes dus.
- CTA principal : Encaisser un paiement si le flux existe, sinon aucun CTA fort.
- aucun bouton Recharger/Actualiser/Exporter.

4. Onglets secondaires :
Les deux pages doivent avoir les mêmes onglets :
- Paiements reçus
- Créances à recouvrer

Sur Paiements reçus : Paiements reçus actif.
Sur Créances à recouvrer : Créances à recouvrer actif.

5. Style :
Réutiliser le langage visuel de :
- Bailleurs
- Patrimoine
- Dashboard

Ne crée pas une nouvelle identité finance.

Validation visuelle attendue :
- la page ne commence pas brutalement par la table ;
- le titre est visible ;
- le CTA principal est clair ;
- aucun Export/Recharger n’est visible.

Ne touche pas encore aux KPI, toolbars, tables, drawers ou wizards.
```

---

## 3. Prompt — Restaurer les KPI Finance avec l’architecture commune

```txt
[COLLER ICI LE BLOC 0 — SÉCURITÉ OBLIGATOIRE]

Objectif :
Remettre les KPI Finance au niveau des KPI réussis de Bailleurs / Patrimoine / Dashboard.

Fichiers autorisés :
- src/pages/Paiements.tsx
- src/pages/LoyersImpayes.tsx
- src/pages/Depenses.tsx
- src/components/ui/MetricCard.tsx uniquement si nécessaire
- src/components/ui/MoneyText.tsx uniquement si nécessaire

Références obligatoires à inspecter avant modification :
- src/pages/Bailleurs.tsx
- src/pages/Patrimoine.tsx
- src/pages/Dashboard.tsx
- src/components/ui/MetricCard.tsx
- src/components/ui/MoneyText.tsx

Règles :
- utiliser l’architecture commune KPI quand elle existe ;
- ne pas créer un nouveau composant KPI isolé ;
- toute la carte doit réagir au hover, pas seulement le haut ;
- arrondi, padding, icône, label, sous-texte et ombre doivent être cohérents avec Bailleurs/Patrimoine ;
- MoneyText / formatCurrency obligatoire pour les montants ;
- format obligatoire : F CFA avec espaces ;
- jamais 6789999F CFA ;
- jamais FCFA collé ;
- ne jamais afficher “RPC” ou un terme technique dans un KPI client.

KPI Paiements reçus :
- Encaissements du mois
- Paiements reçus
- Paiements partiels
- Avances / trop-perçus
- Commissions agence
- Taux de recouvrement

KPI Créances à recouvrer :
- Créances ouvertes
- Retards et reliquats
- Déjà encaissé
- Loyers attendus
- Échéances à venir
- Partiels

KPI Dépenses :
- Dépenses du mois
- Dépenses actives
- Dépenses agence
- Dépenses bailleurs
- Biens concernés
- Net après dépenses

Si une donnée manque :
- afficher 0 proprement ;
- ou un sous-texte neutre ;
- mais ne jamais afficher un terme développeur.

Responsive :
- desktop : montants complets si l’espace le permet ;
- mobile : grille lisible, 2 colonnes si possible ;
- pas de débordement ;
- pas de labels coupés de façon ridicule.

Ne touche pas aux tables, drawers, wizards.
```

---

## 4. Prompt — Toolbar Finance desktop + mobile

```txt
[COLLER ICI LE BLOC 0 — SÉCURITÉ OBLIGATOIRE]

Objectif :
Corriger les toolbars des 3 pages Finance avec le modèle premium de Patrimoine/Bailleurs.

Fichiers autorisés :
- src/pages/Paiements.tsx
- src/pages/LoyersImpayes.tsx
- src/pages/Depenses.tsx

Référence obligatoire :
- src/pages/Patrimoine.tsx

Règles générales :
- pas de toolbar énorme ;
- pas de filtre coupé ;
- pas de select natif visuellement basique si un pattern premium existe déjà ;
- pas d’Export/Recharger/Actualiser ;
- le bouton Colonnes peut rester ;
- recherche + filtres doivent être compacts et alignés.

Desktop Paiements reçus :
Une seule ligne de toolbar :
- recherche : locataire, bien, bailleur, référence
- période
- bailleur
- Colonnes

Chips sous la ligne ou intégrés proprement :
- Tous
- Soldés
- Partiels
- Avances
- Annulés

Desktop Créances à recouvrer :
Une seule ligne :
- recherche : locataire, bien, bailleur
- bailleur
- Colonnes

Chips :
- Toutes
- En retard
- Partiels
- À venir

Desktop Dépenses :
Une seule ligne obligatoire :
- recherche moyenne
- période
- catégorie
- affectation
- Colonnes

Important Dépenses :
Ne pas mettre la toolbar sur 2 lignes.
Si l’espace manque :
- raccourcir la recherche ;
- raccourcir les labels filtres :
  - Catégories
  - Affectations
- mais ne pas couper les textes comme “Toutes les catégori...”.

Mobile :
Sur les 3 pages :
- recherche et bouton Filtres sur la même ligne :
  [ Recherche ........ ] [ Filtres ]
- chips en dessous ;
- pas de hauteur excessive ;
- pas de scroll horizontal global ;
- placeholder mobile court : “Rechercher…”.

Ne touche pas aux KPI, tables, drawers, wizards sauf si nécessaire pour la toolbar.
```

---

## 5. Prompt — Tables Drawer First : supprimer les boutons de ligne

```txt
[COLLER ICI LE BLOC 0 — SÉCURITÉ OBLIGATOIRE]

Objectif :
Appliquer strictement la logique Drawer First sur les tables Finance.

Fichiers autorisés :
- src/pages/Paiements.tsx
- src/pages/LoyersImpayes.tsx
- src/pages/Depenses.tsx
- src/components/ui/Table.tsx uniquement si une prop onRowClick existe déjà ou doit être corrigée proprement

Règle Samay Këur :
La table sert à parcourir et sélectionner.
Les actions vivent dans le drawer.

À faire :

1. Paiements reçus :
Supprimer des lignes :
- Voir
- PDF
- Corriger
- Annuler

La ligne entière ouvre le drawer Paiement.

2. Créances à recouvrer :
Supprimer :
- Voir en ligne
- Encaisser en ligne si le drawer permet l’action

La ligne entière ouvre le drawer Créance.

3. Dépenses :
Supprimer :
- Voir
- Corriger
- Annuler

La ligne entière ouvre le drawer Dépense.

4. Ajouter état de ligne :
- hover premium ;
- cursor pointer ;
- ligne sélectionnée quand drawer ouvert ;
- focus clavier visible ;
- aria-label propre.

5. Actions à déplacer dans drawers :
Paiement :
- voir quittance
- télécharger PDF
- envoyer
- corriger
- annuler

Créance :
- encaisser
- contacter
- voir contrat/paiements liés si disponible

Dépense :
- modifier
- annuler
- justificatif/document GED si disponible

Interdit :
- ne pas supprimer les fonctions existantes ;
- ne pas casser le drawer ;
- ne pas faire de refonte globale de table ;
- ne pas modifier backend/RPC.
```

---

## 6. Prompt — Drawers intégrés en colonne droite

```txt
[COLLER ICI LE BLOC 0 — SÉCURITÉ OBLIGATOIRE]

Objectif :
Corriger l’intégration desktop des drawers Finance.

Fichiers autorisés :
- src/pages/Paiements.tsx
- src/pages/LoyersImpayes.tsx
- src/pages/Depenses.tsx

Problème :
Les drawers donnent parfois l’impression d’être posés par-dessus la page.
Sur desktop, ils doivent devenir une vraie colonne droite intégrée.

Comportement attendu desktop :
- sans drawer : contenu pleine largeur ;
- avec drawer : layout deux colonnes ;
- colonne principale rétractée ;
- drawer à droite ;
- pas de gros overlay desktop ;
- colonnes secondaires masquées/compactées ;
- scroll interne propre dans le drawer.

Comportement attendu mobile :
- bottom-sheet ou drawer mobile adapté ;
- pas de contenu caché par la bottom nav ;
- CTA accessibles.

Colonnes prioritaires quand drawer ouvert :

Paiements reçus :
- Locataire
- Bien / unité
- Période
- Montant reçu
- Reliquat
- Statut

Créances :
- Locataire
- Bien / unité
- Période
- Statut
- Reste dû

Dépenses :
- Date
- Catégorie
- Montant
- Affectation/statut

Colonnes secondaires à masquer ou compacter :
- mode
- téléphone
- actions
- description longue
- bénéficiaire
- immeuble si redondant

Style drawer :
- largeur cohérente ;
- bord gauche subtil ;
- header fort ;
- sections compactes ;
- actions principales visibles ;
- historique si disponible ;
- même langage visuel que Bailleurs/Patrimoine.

Ne touche pas aux wizards.
```

---

## 7. Prompt — Drawer Paiement premium Ledger First

```txt
[COLLER ICI LE BLOC 0 — SÉCURITÉ OBLIGATOIRE]

Objectif :
Améliorer le drawer Paiement pour qu’il devienne une vraie fiche financière premium.

Fichier autorisé :
- src/pages/Paiements.tsx

Problèmes actuels :
- titre trop technique : Paiement 5d5320a3 ;
- montant pas assez dominant ;
- bouton Envoyer désactivé peu clair ;
- actions pas assez hiérarchisées ;
- drawer encore trop administratif.

À faire :

Header attendu :
Paiement #PAY-2026-XXXX   [Soldé/Partiel/Annulé]
500 000 F CFA
Mohamed Diop · Appartement F3 · juin 2026
Enregistré le 03/06/2026 · Espèces

Si la référence métier n’existe pas :
- garder un fallback propre ;
- éviter d’afficher uniquement un id technique brut.

Sections attendues :
1. Résumé paiement
- montant reçu
- période
- date paiement
- mode
- référence

2. Affectation
- locataire
- bien / unité
- bailleur
- contrat

3. Impact financier
- loyer attendu
- total déjà encaissé
- reliquat
- commission agence
- net bailleur

4. Documents liés
- quittance/facture
- PDF
- QR/GED si disponible
Couleur rouge seulement si problème.
Document prêt = neutre/vert/ivoire.

5. Historique
Timeline :
- Paiement enregistré
- Écriture ledger créée
- Quittance générée
- Document archivé GED
- Correction/annulation si applicable

6. Actions contrôlées
- Corriger une erreur
- Annuler le paiement

Règles :
- masquer “Envoyer” si indisponible au lieu d’un bouton mort ;
- ne pas afficher “Supprimer” ;
- actions critiques uniquement dans drawer ;
- MoneyText obligatoire ;
- F CFA obligatoire.
```

---

## 8. Prompt — Créances à recouvrer : densité, drawer et encaissement

```txt
[COLLER ICI LE BLOC 0 — SÉCURITÉ OBLIGATOIRE]

Objectif :
Reprendre la page Créances à recouvrer pour qu’elle soit dense, fiable et opérationnelle.

Fichier autorisé :
- src/pages/LoyersImpayes.tsx

À faire :

1. Wording :
- remplacer le titre “Loyers impayés” par “Créances à recouvrer” si pas encore fait.
- garder “En retard” seulement comme statut, pas comme nom de page.

2. Table :
- réduire la hauteur des lignes ;
- badge “En retard” sur une seule ligne :
  jamais “En / retard” ;
- white-space nowrap sur le badge ;
- téléphone formaté :
  77 222 22 22
  pas 772222222 ;
- téléphone cliquable tel:;
- montants MoneyText / F CFA ;
- reste dû en rouge seulement ;
- lignes cliquables drawer first ;
- pas de bouton Voir en ligne.

3. Chips :
Ordre recommandé :
- Toutes
- En retard
- Partiels
- À venir

4. Drawer Créance :
Header attendu :
200 000 F CFA à recouvrer
Fatoumata Ly Déme · Appartement F4
En retard · juin 2026

Sections :
- Résumé créance
- Affectation
- Contact
- Historique / source serveur
- Actions

Action principale :
- Encaisser ce loyer

Cette action doit ouvrir le flux de paiement prérempli si le mécanisme existe :
- contrat
- période
- montant restant
- locataire
- bien/unité

Si le préremplissage n’existe pas encore :
- préparer proprement le passage de props/état ;
- ne pas faire de hack.

5. Texte “source serveur” :
Le garder discret.
UX métier :
- Échéance certifiée
- Aucun montant reconstruit côté interface

Pas de jargon développeur visible.

Ne touche pas à Paiements/Dépenses sauf nécessité explicite.
```

---

## 9. Prompt — Dépenses : restaurer la page premium

```txt
[COLLER ICI LE BLOC 0 — SÉCURITÉ OBLIGATOIRE]

Objectif :
Reconstruire Dépenses proprement après la perte partielle.

Fichier autorisé :
- src/pages/Depenses.tsx

À faire :

1. Header premium :
- surtitre : CHARGES & EXPLOITATION
- titre serif : Dépenses
- sous-titre : Suivez les charges, frais d’exploitation, dépenses rattachées et corrections via les workflows financiers contrôlés.
- CTA : Nouvelle dépense

2. KPI :
Restaurer 6 KPI avec architecture commune :
- Dépenses du mois
- Dépenses actives
- Dépenses agence
- Dépenses bailleurs
- Biens concernés
- Net après dépenses

Interdit :
- ne jamais afficher RPC ;
- ne jamais afficher de jargon technique client.

3. Toolbar :
Une seule ligne desktop :
- recherche moyenne
- période
- catégorie
- affectation
- Colonnes

Mobile :
- recherche + Filtres sur la même ligne ;
- chips/filtres sous forme compacte si nécessaire.

4. Table :
Colonnes recommandées :
- Date
- Catégorie
- Montant
- Affectation
- Bénéficiaire
- Bien / bailleur
- Statut

Ligne cliquable.
Supprimer :
- Voir
- Corriger
- Annuler
en ligne.

5. Drawer Dépense :
Header :
- montant
- catégorie
- date
- statut

Sections :
- Résumé
- Affectation & description
- Justificatif
- Impact financier
- Historique
- Actions contrôlées

Actions dans drawer :
- Modifier
- Annuler
- Voir justificatif si disponible
- Voir document GED si disponible

6. Mutations :
Toutes les mutations doivent passer par financeApi/RPC existants :
- fn_finance_create_depense
- fn_finance_update_depense
- fn_finance_cancel_depense

Interdit :
- insert direct ;
- update direct ;
- delete physique.

Ne touche pas encore au wizard Nouvelle dépense sauf si le formulaire existant doit juste s’ouvrir.
```

---

## 10. Prompt — Nouveau paiement en vrai wizard

```txt
[COLLER ICI LE BLOC 0 — SÉCURITÉ OBLIGATOIRE]

Objectif :
Transformer Nouveau paiement en vrai wizard premium Samay Këur.

Fichiers autorisés :
- src/pages/Paiements.tsx
- src/components/paiements/PaiementFormModal.tsx si c’est là que vit le formulaire
- services paiement uniquement si nécessaire sans changer l’architecture

Structure attendue :

Étape 1 — Contrat & échéance
- contrat / locataire / bien-unité
- période concernée
- contrats actifs uniquement
- résumé :
  - locataire
  - bailleur
  - bien/unité
  - loyer attendu
  - déjà encaissé
  - reste à payer
  - statut actuel

Étape 2 — Paiement reçu
- montant encaissé
- date paiement
- mode paiement
- référence transaction facultative
- justificatif facultatif si disponible

Modes :
- Espèces
- Wave
- Orange Money
- Virement
- Chèque
- Autre

Étape 3 — Impact & validation
Afficher avant validation :
- montant dû
- montant reçu
- reliquat après paiement
- avance / trop-perçu
- commission agence
- net bailleur
- document généré
- statut final prévu : Soldé / Partiel / Avance

Règles techniques :
- passer par create-paiement / paiementApi existant ;
- pas d’insert direct ;
- préserver idempotency key ;
- prévenir double clic ;
- le serveur reste la source finale ;
- l’UI ne fait qu’une prévisualisation.

UX :
- stepper clair ;
- style wizard onboarding récent ;
- bouton principal vert profond ;
- mobile bottom-sheet utilisable ;
- pas de champ coupé ;
- dropdowns premium si pattern existant.
```

---

## 11. Prompt — Nouvelle dépense en vrai wizard

```txt
[COLLER ICI LE BLOC 0 — SÉCURITÉ OBLIGATOIRE]

Objectif :
Transformer Nouvelle dépense / Modifier dépense en workflow guidé premium.

Fichiers autorisés :
- src/pages/Depenses.tsx
- éventuel composant modal dépense si séparé

Structure attendue :

Étape 1 — Nature de la dépense
- catégorie
- montant
- date
- description

Étape 2 — Affectation
- dépense agence
- dépense bailleur
- dépense liée à un bien
- dépense refacturable si la donnée existe
- bénéficiaire
- bien / bailleur / unité si applicable

Étape 3 — Justificatif & validation
- justificatif optionnel
- résumé financier
- impact agence / bailleur
- validation finale

CTA :
- Enregistrer la dépense
- Modifier la dépense en mode édition

Règles :
- passer par financeApi ;
- utiliser fn_finance_create_depense / update / cancel ;
- pas d’insert direct ;
- pas d’update direct ;
- pas de delete physique ;
- MoneyText / formatCurrency ;
- F CFA ;
- mobile-first.

Design :
- même style que le wizard Nouveau paiement ;
- stepper clair ;
- bloc résumé métier ;
- bouton principal vert profond ;
- bouton secondaire sobre.

Ne touche pas aux autres pages.
```

---

## 12. Prompt — Correction et annulation paiement/dépense contrôlées

```txt
[COLLER ICI LE BLOC 0 — SÉCURITÉ OBLIGATOIRE]

Objectif :
Rendre les corrections et annulations cohérentes avec Ledger First.

Fichiers autorisés :
- src/pages/Paiements.tsx
- src/pages/Depenses.tsx
- composants modaux liés uniquement si existants

Paiement — Corriger :
- titre : Corriger une erreur de paiement
- afficher valeur actuelle
- afficher nouvelle valeur
- afficher impact avant validation
- raison de correction obligatoire ou fortement recommandée
- passer par update-paiement Edge Function/API existante
- jamais update direct.

Paiement — Annuler :
- titre : Annuler le paiement
- raison obligatoire
- résumé du paiement
- avertissement :
  Le paiement sera marqué annulé et restera visible dans l’historique.
- passer par cancel-paiement Edge Function/API existante
- jamais delete direct
- statut final : Annulé

Dépense — Corriger :
- même logique métier
- passer par fn_finance_update_depense

Dépense — Annuler :
- pas de delete physique
- passer par fn_finance_cancel_depense
- raison recommandée/obligatoire si champ disponible

Après validation :
- refresh données
- KPI à jour
- table à jour
- drawer si possible maintenu
- toast clair.

Interdit :
- bouton Supprimer ;
- action critique en table ;
- mutation directe.
```

---

## 13. Prompt — Finition mobile Finance

```txt
[COLLER ICI LE BLOC 0 — SÉCURITÉ OBLIGATOIRE]

Objectif :
Finaliser le mobile des 3 pages Finance.

Fichiers autorisés :
- src/pages/Paiements.tsx
- src/pages/LoyersImpayes.tsx
- src/pages/Depenses.tsx
- composants modaux/wizards finance liés

À vérifier/corriger :

Paiements reçus mobile :
- H1 visible ;
- CTA Nouveau paiement visible ;
- pas d’Export ;
- KPI lisibles en 2 colonnes ;
- recherche + Filtres même ligne ;
- chips lisibles ;
- paiements en cartes mobiles ou table adaptée ;
- drawer/bottom-sheet propre ;
- actions dans drawer.

Créances mobile :
- titre Créances à recouvrer ;
- KPI lisibles ;
- badge En retard sur une seule ligne ;
- téléphone formaté ;
- recherche + Filtres même ligne ;
- cartes compactes ;
- action Encaisser dans drawer ou carte si strictement nécessaire ;
- pas de scroll horizontal global.

Dépenses mobile :
- header premium ;
- KPI restaurés ;
- recherche + Filtres même ligne ;
- dépenses en cartes lisibles ;
- drawer/bottom-sheet utilisable ;
- wizard dépense utilisable.

Wizards :
- Nouveau paiement ;
- Nouvelle dépense ;
- Correction ;
- Annulation.

Tous doivent :
- tenir sur mobile ;
- avoir scroll interne propre ;
- ne pas passer sous la bottom navigation ;
- CTA accessible ;
- dropdowns utilisables ;
- pas de champ coupé.

Ajouter padding-bottom si nécessaire à cause de la bottom navigation.
```

---

## 14. Prompt — Nettoyage final Finance

```txt
[COLLER ICI LE BLOC 0 — SÉCURITÉ OBLIGATOIRE]

Objectif :
Dernière passe de cohérence premium sur Finance.

Fichiers autorisés :
- src/pages/Paiements.tsx
- src/pages/LoyersImpayes.tsx
- src/pages/Depenses.tsx
- composants UI finance liés uniquement si nécessaire

À vérifier :

1. Wording :
- Paiements reçus
- Créances à recouvrer
- Dépenses
- pas “Loyers impayés” visible dans la navigation principale finance.

2. Aucun terme technique visible :
- RPC
- id brut seul
- ledger brut mal expliqué
- source serveur trop développeur
- delete/supprimer finance

Remplacer par wording métier :
- Traçabilité certifiée
- Écriture financière créée
- Document vérifiable
- Historique sécurisé
- Annulation contrôlée

3. Montants :
- MoneyText / formatCurrency ;
- F CFA ;
- espaces corrects ;
- pas de FCFA collé ;
- tolérance 1–3 F CFA affichée comme 0 F CFA.

4. Actions :
- pas de boutons Voir/PDF/Corriger/Annuler en table ;
- actions dans drawer ;
- CTA principal clair ;
- actions secondaires sobres.

5. Empty states :
- aucun paiement ;
- aucune créance ;
- aucune dépense.
Chaque état vide doit être premium et actionnable.

6. Validation :
- desktop Paiements
- desktop Créances
- desktop Dépenses
- mobile Paiements
- mobile Créances
- mobile Dépenses
- drawers
- wizards

Rapport final attendu :
- fichiers modifiés ;
- composants réutilisés ;
- validations ;
- points à vérifier visuellement.
```

---

## Ordre conseillé

```txt
1. État des lieux sans modification
2. Wording + Page Shell
3. KPI
4. Toolbar
5. Tables Drawer First
6. Drawers intégrés
7. Drawer Paiement
8. Créances densité + drawer
9. Dépenses premium
10. Wizard Nouveau paiement
11. Wizard Dépense
12. Correction / Annulation
13. Mobile
14. Nettoyage final
```

## Règle de survie

Après chaque prompt validé visuellement :

```bash
git add .
git commit -m "checkpoint: finance step X validated"
```

Ne jamais enchaîner 3 prompts sans checkpoint.
