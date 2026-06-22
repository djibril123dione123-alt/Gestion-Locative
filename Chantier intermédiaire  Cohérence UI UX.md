

# Charte Header Samay Këur — Version verrouillée

## 1. Principe général

Samay Këur doit avoir **une norme principale**, et seulement **deux exceptions contrôlées**.

```txt
Norme principale :
Header clair premium

Exception 1 :
Hero sombre coffre

Exception 2 :
Header registre documentaire
```

On ne crée pas une nouvelle variante à chaque page. C’est ça qui va donner l’impression d’une app conçue par une seule direction produit.

---

# 2. Header standard principal

## Pages concernées

Ce header devient la norme pour :

```txt
Tableau de bord
Bailleurs
Biens & patrimoine
Locations
Paiements reçus
Créances à recouvrer
Dépenses
Rapports
Administration
Paramètres
```

## Référence visuelle

La référence actuelle est :

```txt
Paiements reçus
Dépenses
Créances à recouvrer
```

Donc les anciens headers de :

```txt
Dashboard
Bailleurs
Biens & patrimoine
Locations
```

doivent migrer vers cette famille.

## Structure desktop

Le header standard doit être une **carte claire premium** :

```txt
fond blanc/crème
bordure douce
rounded-2xl / rounded-3xl
ombre très légère
padding généreux mais pas énorme
eyebrow en haut
titre serif
description courte
actions à droite
```

## Structure mobile

Sur mobile :

```txt
carte claire arrondie
eyebrow
titre serif
description courte
CTA pleine largeur si action principale
CTA secondaire en dessous si nécessaire
aucun texte long
aucun bloc secondaire massif
```

---

# 3. Règles typographiques

## Eyebrow

Toujours :

```txt
uppercase
letter-spacing fort
petite taille
couleur domaine
font-semibold / font-bold
```

Exemples validés :

```txt
PILOTAGE AGENCE
PORTEFEUILLE PROPRIÉTAIRE
PORTEFEUILLE LOCATIF
DOMAINE LOCATIF
ENCAISSEMENT & FINANCE
CHARGES & EXPLOITATION
COFFRE DOCUMENTAIRE
REGISTRE DOCUMENTAIRE
```

## Titre

Règle verrouillée :

```txt
Tous les headers principaux utilisent la police serif.
```

Donc :

```txt
Dashboard : serif
Bailleurs : serif
Biens : serif
Locations : serif
Finance : serif
Dépenses : serif
Documents : serif
```

Scanner peut aussi utiliser la serif pour rester cohérent avec Documents.

## Description

Règle :

```txt
Desktop : 1 ligne si possible.
Mobile : 1 ligne idéale, 2 lignes maximum.
```

Pas de phrase longue, pas de breadcrumb métier dans la description.

---

# 4. Textes validés page par page

## Tableau de bord

Desktop :

```txt
Eyebrow : PILOTAGE AGENCE
Titre : Tableau de bord
Description : Vue unifiée du portefeuille, des encaissements et des priorités.
```

Mobile :

```txt
Description : Vue agence unifiée.
```

Action :

```txt
Enregistrer un paiement
```

Le filtre mois doit rester, mais il doit être **moins dominant sur mobile**.

---

## Bailleurs

Desktop :

```txt
Eyebrow : PORTEFEUILLE PROPRIÉTAIRE
Titre : Bailleurs
Description : Gérez vos propriétaires, mandats et revenus locatifs.
```

Mobile :

```txt
Description : Propriétaires, mandats et revenus.
```

Action :

```txt
Nouveau bailleur
```

---

## Biens & patrimoine

Desktop :

```txt
Eyebrow : PORTEFEUILLE LOCATIF
Titre : Biens & patrimoine
Description : Suivez vos biens, unités et leur potentiel locatif.
```

Mobile :

```txt
Description : Biens, unités et occupation.
```

Actions :

```txt
Principal : Nouveau bien
Secondaire : Nouvelle unité
```

Sur mobile, le bouton secondaire doit rester plus léger que le bouton principal.

---

## Locations

Desktop :

```txt
Eyebrow : DOMAINE LOCATIF
Titre : Locations
Description : Suivez les occupants, baux actifs et unités louées.
```

Mobile :

```txt
Description : Occupants, baux et unités.
```

Action :

```txt
Nouvelle location
```

À supprimer du header :

```txt
Vue unifiée locataire → location → unité · 21 locations suivies
```

Cette phrase est trop technique et trop longue. Le compteur peut aller dans les KPI ou la toolbar, pas dans le header mobile.

---

## Paiements reçus

Desktop :

```txt
Eyebrow : ENCAISSEMENT & FINANCE
Titre : Paiements reçus
Description : Encaissements validés et quittances.
```

Mobile : pareil, c’est déjà assez court.

Action :

```txt
Nouveau paiement
```

---

## Créances à recouvrer

Desktop :

```txt
Eyebrow : ENCAISSEMENT & FINANCE
Titre : Créances à recouvrer
Description : Retards, partiels et restes dus.
```

Mobile : pareil.

Action : pas obligatoire.

Mais si le header paraît trop vide, on peut ajouter plus tard une action utile :

```txt
Relancer
Exporter
Nouveau paiement
```

Pas maintenant. On décidera au bloc toolbar/action.

---

## Dépenses

Desktop :

```txt
Eyebrow : CHARGES & EXPLOITATION
Titre : Dépenses
Description : Charges et corrections contrôlées.
```

Mobile : pareil.

Action :

```txt
Nouvelle dépense
```

---

# 5. Exception 1 — Documents

Documents garde une identité spéciale.

## Type

```txt
Hero sombre coffre
```

## Pages concernées

```txt
Documents uniquement
```

## Règles

```txt
fond vert profond
titre serif
titre en blanc/crème ou contraste parfaitement lisible
description courte
CTA Scanner + Ajouter au coffre
stockage discret
pas de surcharge
```

Le stockage ne doit jamais dominer la page. Il doit rester secondaire.

Texte validé :

```txt
Eyebrow : COFFRE DOCUMENTAIRE
Titre : Documents
Description : Centralisez, retrouvez et vérifiez vos preuves.
```

Mobile :

```txt
Description : Retrouvez et vérifiez vos preuves.
```

ou garder l’actuel si ça tient proprement.

---

# 6. Exception 2 — Scanner

Scanner garde une variante spéciale, mais contrôlée.

## Type

```txt
Header registre clair avec liseré supérieur
```

## Pages concernées

```txt
Scanner un document
Vérification documentaire interne
```

## Règles

```txt
fond clair
liseré supérieur vert/or
badge registre
titre serif recommandé
description courte
bloc sécurité discret
```

Texte validé :

```txt
Eyebrow : REGISTRE DOCUMENTAIRE
Titre : Scanner un document
Description desktop : Scannez un QR pour confirmer l’authenticité d’une preuve.
Description mobile : Scannez un QR pour vérifier une preuve.
```

Le bloc :

```txt
Seules les informations publiques nécessaires au contrôle sont affichées.
```

doit rester, mais discret.

---

# 7. Règles CTA

## Desktop

```txt
CTA à droite
bouton principal vert sombre
bouton secondaire blanc/outline
icône + texte
```

## Mobile

```txt
CTA principal pleine largeur
CTA secondaire pleine largeur ou demi-largeur selon place
ne jamais faire des boutons trop petits
ne jamais pousser le contenu hors écran
```

Dashboard est un cas spécial : le filtre mois ne doit pas rivaliser visuellement avec le CTA.

---

# 8. Règles mobile strictes

Sur iPhone 12 Pro :

```txt
aucun header ne doit dépasser horizontalement
aucune description ne doit ressembler à un paragraphe
aucun CTA ne doit être coupé
aucun bloc secondaire ne doit dominer le titre
hauteur mobile contrôlée
```

Objectif mobile :

```txt
L’utilisateur comprend la page en moins de 2 secondes.
```

---

# 9. Ce qu’on interdit désormais

```txt
Créer une nouvelle variante de header pour une page isolée
Mettre des descriptions longues dans le header mobile
Mettre des breadcrumbs dans les descriptions
Laisser un ancien header plat quand le reste est en carte premium
Mettre un bloc secondaire plus fort que le titre
Utiliser une police différente pour les titres de page sans raison
```

---

# 10. Décision finale verrouillée

```txt
Header standard officiel = modèle Finance clair.
À appliquer à Dashboard, Bailleurs, Biens, Locations, Rapports, Administration.

Documents = exception sombre “coffre”.
Scanner = exception claire “registre”.

Tous les titres principaux utilisent la serif.
Toutes les descriptions mobile sont raccourcies.
Tous les CTA suivent la hiérarchie principal / secondaire.
```

Ça, c’est notre norme Header.


Voici la **Charte KPI Samay Këur — v1** à verrouiller avant de coder. Elle doit servir de référence pour toutes les pages.

# Charte KPI Samay Këur — Cohérence Premium

## 1. Rôle des KPI

Un KPI Samay Këur ne doit pas être une décoration. Il doit répondre à une question métier claire :

```txt
Combien ?
Combien d’argent ?
Quel risque ?
Quelle priorité ?
Quel état du portefeuille ?
```

Un KPI doit aider l’agence à comprendre la situation en **2 secondes**.

------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 2. Structure standard d’une carte KPI

Chaque KPI suit cette structure :

```txt
Titre court
Valeur principale
Helper métier court
Icône discrète en haut à droite
```

Exemple :

```txt
RELIQUATS
2,74 M F CFA
À recouvrer
```

ou :

```txt
PREUVES ACTIVES
80
Documents disponibles
```

## Règle importante

La carte ne doit jamais afficher trop de couches.

À éviter hors Dashboard :

```txt
Titre
Badge interne
Valeur
Helper
Sous-helper
Icône
CTA
```

Ça devient trop chargé.

---

# 3. Nombre de KPI par page

## Desktop

Desktop peut afficher :

```txt
4 à 6 KPI maximum
```

Mais seulement si les KPI sont vraiment utiles.

## Mobile

Règle verrouillée :

```txt
Toutes les pages sauf Tableau de bord :
4 KPI visibles maximum par défaut.
```

Format mobile :

```txt
2 colonnes × 2 lignes
```

Les KPI supplémentaires doivent aller dans :

```txt
Indicateurs complémentaires
Voir plus d’indicateurs
```

ou être fusionnés.

## Exception

Le **Tableau de bord** peut afficher plus de 4 KPI, car c’est le cockpit global.

Mais même sur Dashboard, il faut éviter le bruit inutile.

---

# 4. Hiérarchie visuelle

## Titre

Le titre est en uppercase, petit, avec letter spacing maîtrisé.

Exemple :

```txt
ENCAISSEMENTS
RELIQUATS
NET BAILLEURS
PREUVES ACTIVES
```

Règle mobile :

```txt
Titre KPI = 2 lignes maximum.
Si le titre casse mal, on raccourcit.
```

Exemples de raccourcis :

```txt
BAILLEURS ACTIFS → BAILLEURS
TAUX DE RECOUVREMENT → RECOUVREMENT
DÉPENSES DU MOIS → DÉPENSES
```

---

# 5. Valeur principale

La valeur est l’élément dominant.

## Couleur par défaut

Par défaut, la valeur doit rester foncée :

```txt
text-slate-950 / text-[#07111f]
```

La couleur ne doit pas être utilisée partout.

## Quand colorer une valeur ?

On colore seulement quand la couleur porte un sens métier fort.

```txt
Vert = sain / encaissé / actif / net positif
Rouge = risque / retard / reliquat / dépense critique
Orange = attention / partiel / taux à surveiller
Bleu = preuve / information / QR / registre
```

## Interdiction

Ne pas colorer tous les chiffres juste pour “faire joli”.

Exemple à éviter :

```txt
BIENS en vert
UNITÉS en noir
OCCUPÉES en vert
OCCUPATION en orange
LOYERS en vert
RELIQUATS en rouge
```

Ça fait dispersé.

Meilleure règle :

```txt
Valeur foncée par défaut.
Couleur uniquement si alerte ou signal métier.
```

---

# 6. Format des montants

Tous les montants doivent passer par un formatter unique.

## Desktop

Desktop peut afficher les montants longs :

```txt
6 990 000 F CFA
2 736 600 F CFA
428 100 F CFA
```

## Mobile

Mobile doit utiliser un format compact pour éviter les débordements :

```txt
6,99 M F CFA
2,74 M F CFA
428 k F CFA
57,1 M F CFA
```

## Interdits

Ne jamais mélanger :

```txt
57,1M FCFA
3,7M FCFA
428100 FCFA
11256 601 FCFA
6 990 000 F CFA
```

Norme unique :

```txt
F CFA
```

Pas `FCFA`, pas `F CFA` mélangé avec `FCFA`.

---

# 7. Helper text

Le helper doit expliquer le chiffre.

Bon :

```txt
Documents disponibles
À recouvrer
À reverser
Validés ce mois
Charges enregistrées
Lien public disponible
```

Moins bon :

```txt
Ce mois
Calcul global
Écritures
Patrimoine
```

Règle :

```txt
Helper = 1 ligne max sur mobile.
```

---

# 8. Icône

L’icône est un signal secondaire.

Elle doit être :

```txt
petite
discrète
en haut à droite
dans un carré doux
cohérente avec la couleur du KPI
```

Elle ne doit jamais dominer la carte.

---

# 9. Fonds et bordures

Chaque KPI peut avoir une légère teinte.

Norme :

```txt
fond blanc/crème
gradient très léger
bordure douce
ombre subtile
radius premium
```

Couleurs sémantiques :

```txt
Succès / actif     → vert doux
Risque / retard    → rouge doux
Attention / partiel → orange doux
Information / QR   → bleu doux
Neutre             → gris/ardoise doux
```

Le fond doit rester premium. Pas de carte trop saturée.

---

# 10. KPI cliquables

Un KPI peut être cliquable uniquement s’il déclenche une vraie action :

```txt
filtrer la liste
ouvrir une vue
afficher les dossiers concernés
```

## État normal

La carte reste une carte KPI, pas un bouton.

## État hover

```txt
ombre légèrement renforcée
bordure un peu plus visible
cursor-pointer
```

## État actif

```txt
ring léger
fond légèrement teinté
bordure accentuée
```

Interdit :

```txt
fond vert massif
texte inversé
style tab agressif
```

Le KPI actif doit être visible mais élégant.

---

# 11. Badges internes

Les petits badges internes du type :

```txt
VOLUME LOCATIF
À TRAITER
NET PROPRIÉTAIRE
MARGE BRUTE
```

sont autorisés principalement sur le **Tableau de bord**, parce que c’est une page de pilotage.

Sur les pages métier, il faut les éviter par défaut.

Règle :

```txt
Dashboard = badges internes autorisés.
Pages métier = pas de badge interne sauf nécessité forte.
```

---

# 12. Variants KPI

## A. KPI standard

Pour les volumes :

```txt
BAILLEURS
9
Propriétaires actifs
```

## B. KPI financier

Pour les montants :

```txt
NET BAILLEURS
57,1 M F CFA
À reverser
```

## C. KPI risque

Pour les alertes :

```txt
RELIQUATS
2,74 M F CFA
À recouvrer
```

## D. KPI filtre

Pour les pages où les KPI filtrent la liste :

```txt
BAUX ACTIFS
21
En cours
```

C’est le cas de **Locations** et possiblement **Documents**.

## E. KPI preuve / registre

Pour Documents :

```txt
VÉRIFIABLES QR
74
Contrôlables publiquement
```

---

# 13. Norme page par page

## Tableau de bord

Exception : peut afficher 6 KPI.

KPI recommandés :

```txt
ENCAISSEMENTS
RELIQUATS
NET BAILLEURS
COMMISSIONS
BAUX ACTIFS
OCCUPATION
```

Dashboard peut garder les badges internes, mais ils doivent rester sobres.

---

## Bailleurs

4 KPI visibles mobile et desktop :

```txt
BAILLEURS
9
Propriétaires actifs

RELIQUATS
200 k F CFA
À suivre

NET BAILLEURS
57,1 M F CFA
À reverser

COMMISSIONS
3,7 M F CFA
Revenus agence
```

---

## Biens & patrimoine

Mobile : 4 visibles max.

KPI principaux :

```txt
BIENS
7
Patrimoine suivi

UNITÉS
24
Lots enregistrés

LOYERS
11,26 M F CFA
Revenus attendus

RELIQUATS
200 k F CFA
À suivre
```

À fusionner ou mettre en secondaire :

```txt
OCCUPÉES
OCCUPATION
```

Meilleure fusion possible :

```txt
OCCUPATION
100 %
24 / 24 unités
```

---

## Locations

Doit devenir un vrai **KPI-filtre premium**, pas un bouton déguisé.

```txt
LOCATIONS SUIVIES
21
Tous les dossiers

BAUX ACTIFS
21
En cours

EXPIRÉS
0
À surveiller

RÉSILIÉS
0
Hors cycle actif
```

Les 4 restent visibles sur mobile.

---

## Encaissements

Mobile : 4 visibles.

```txt
ENCAISSEMENTS
6,99 M F CFA
Validés ce mois

PAIEMENTS REÇUS
13
Ce mois

PAIEMENTS PARTIELS
2
À suivre

COMMISSIONS
428 k F CFA
Revenus agence
```

Secondaires :

```txt
AVANCES / TROP-PERÇUS
RECOUVREMENT
```

---

## Créances à recouvrer

Mobile : 4 visibles.

```txt
CRÉANCES OUVERTES
9
Échéances non soldées

RETARDS
2,74 M F CFA
À recouvrer

DÉJÀ ENCAISSÉ
1 M F CFA
Sur ces créances

PARTIELS
2
En cours de paiement
```

Secondaires :

```txt
LOYERS ATTENDUS
ÉCHÉANCES À VENIR
```

---

## Dépenses

Mobile : 4 visibles.

```txt
DÉPENSES
187 k F CFA
Mois en cours

DÉPENSES ACTIVES
5
Charges enregistrées

DÉPENSES AGENCE
70 k F CFA
Sur fonds propres

DÉPENSES BAILLEURS
117 k F CFA
Imputables aux biens
```

Secondaires :

```txt
BIENS CONCERNÉS
NET APRÈS DÉPENSES
```

---

## Documents

Déjà bon : 4 KPI.

```txt
PREUVES ACTIVES
80
Documents disponibles

VÉRIFIABLES QR
74
Contrôlables publiquement

À CLASSER
0
Sans lien métier

ARCHIVÉS
0
Conservés hors vue active
```

Documents peut garder des KPI cliquables, mais l’état actif doit rester subtil.

---

# 14. Règles mobile strictes

Sur mobile :

```txt
2 colonnes
4 KPI visibles max hors Dashboard
pas de scroll horizontal
pas de texte qui déborde
pas de montant brut long
pas de titre sur 3 lignes
pas de carte trop haute
pas de badge interne sauf Dashboard
safe area bottom respectée
```

Les KPI doivent rester visibles avant la toolbar, mais ne doivent pas repousser le contenu trop bas.

---

# 15. Règles desktop strictes

Sur desktop :

```txt
hauteur cohérente entre cartes
même radius
même ombre
même padding
même placement icône
même logique de couleur
alignement propre
```

Desktop peut afficher 5 ou 6 KPI si utile, mais les pages doivent garder une densité premium.

---

# 16. Interdits définitifs

```txt
Montants non formatés
FCFA / F CFA mélangés
KPI avec texte sur 3 lignes
Valeurs colorées sans raison
KPI qui ressemblent à des tabs agressives
6 KPI visibles sur mobile hors Dashboard
Badges internes partout
Icônes trop dominantes
Helpers vagues
Cartes compressées juste pour tout faire tenir
```

---

# 17. Composant cible à créer

À terme, il faut un composant unique :

```txt
PremiumKpiCard
```

Avec props :

```ts
type PremiumKpiVariant =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "financial";

type PremiumKpiCardProps = {
  title: string;
  value: string;
  helper?: string;
  icon?: ReactNode;
  variant?: PremiumKpiVariant;
  active?: boolean;
  clickable?: boolean;
  onClick?: () => void;
  compact?: boolean;
  dashboardBadge?: string;
};
```

Et un wrapper :

```txt
PremiumKpiGrid
```

Avec règles :

```txt
desktop: auto-fit / 4 à 6 colonnes selon page
mobile: 2 colonnes
max visible mobile: 4 hors Dashboard
```

---

# 18. Phrase de référence

La norme KPI Samay Këur :

```txt
Un KPI Samay Këur doit être dense, lisible, métier et calme.
Il doit signaler l’essentiel sans transformer la page en mur de chiffres.
```

C’est ça qu’il faut verrouiller.



------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Charte Toolbar Samay Këur — v1

## 1. Rôle d’une toolbar

Une toolbar Samay Këur sert à retrouver, filtrer et changer de vue rapidement.

Elle ne doit pas exposer toute la complexité de la base. Elle doit aider l’utilisateur à répondre vite à une question :

```txt
Qui ?
Quel dossier ?
Quel statut ?
Quelle période ?
Quelle catégorie ?
```

Phrase de référence :

```txt
Une toolbar Samay Këur aide à retrouver vite, pas à montrer tous les filtres possibles.
```

---

## 2. Règle structurelle obligatoire

Toutes les toolbars doivent être **décollées du tableau**.

Interdit :

```txt
toolbar collée au tableau
toolbar dans le même bloc que l’en-tête du tableau
toolbar qui donne l’impression d’être une ligne du tableau
```

Obligatoire :

```txt
KPI
↓ espace
Toolbar dans un bloc premium indépendant
↓ espace
Tableau / cartes / liste
```

La toolbar doit être visuellement un **bloc de contrôle**, pas une partie du tableau.

Norme visuelle :

```txt
fond blanc/crème
border douce
radius large
shadow subtile
padding confortable
marge verticale claire avant le tableau
```

---

## 3. Structure desktop standard

La structure desktop cible :

```txt
Ligne 1 :
[Recherche principale] [Filtre 1] [Filtre 2] [Filtre 3] [Colonnes]

Ligne 2 :
[Chips rapides métier]
```

La ligne 2 existe seulement si les chips apportent une vraie valeur métier.

Exemple :

```txt
[Rechercher un locataire, contrat, référence...] [Mois en cours] [Tous les bailleurs] [Colonnes]

[Tous] [Soldés] [Partiels] [Avances] [Annulés]
```

---

## 4. Structure mobile standard

Deux formats sont autorisés.

### Format A — Pages simples

```txt
[Recherche pleine largeur]
[Filtre 1] [Filtre 2]
[Chips rapides]
```

Exemple : Documents.

### Format B — Pages complexes

```txt
[Recherche] [Filtres]
[Chips rapides]
```

Exemple : Bailleurs, Encaissements, Dépenses.

Sur mobile, ne pas afficher `Colonnes` si la vue est en cartes.

---

## 5. Recherche

La recherche est toujours l’élément principal.

Elle doit être large, visible et métier.

À éviter :

```txt
Rechercher...
```

À préférer :

```txt
Rechercher un propriétaire, téléphone, email...
Rechercher un locataire, unité, échéance...
Rechercher un paiement, locataire, référence...
Rechercher une dépense, bien, fournisseur...
Rechercher un document, une référence...
```

Règles :

```txt
placeholder court mais précis
pas de texte qui déborde
pas de recherche minuscule coincée entre trop de filtres
```

---

## 6. Filtres visibles

Sur desktop :

```txt
Recherche + 2 à 3 filtres visibles + Colonnes
```

Sur mobile :

```txt
Recherche + 1 bouton Filtres
```

ou :

```txt
Recherche + 2 filtres maximum
```

Si une page a plus de filtres, ils vont dans un bottom sheet ou drawer de filtres avancés.

Interdit :

```txt
5 filtres visibles sur mobile
toolbar qui passe sur 4 lignes
filtres longs qui écrasent la recherche
```

---

## 7. Chips rapides métier

Les chips rapides doivent être uniformisées sur le modèle Documents.

Forme obligatoire :

```txt
pill arrondie
hauteur compacte
bordure douce
compteur discret
scroll horizontal contrôlé sur mobile
```

Style actif :

```txt
fond vert profond
texte clair
compteur intégré
pas de soulignement
```

Style inactif :

```txt
fond blanc/crème
texte ardoise
bordure légère
compteur gris/bleu doux
```

Interdit :

```txt
tabs avec underline
chips carrées
chips trop longues
chips sur plusieurs lignes non contrôlées
scroll horizontal global
```

---

## 8. Nombre de chips

Desktop :

```txt
4 à 7 chips maximum
```

Mobile :

```txt
4 à 6 chips maximum dans le rail visible
```

Si une page a trop d’options, garder seulement les plus utiles en chips et mettre le reste dans `Filtres`.

Exemple mauvais :

```txt
Tous
Avec reliquats
Sans reliquats
Avec biens
Sans biens
Commission élevée
Actifs
Résiliés
Suspendus
```

Exemple meilleur :

```txt
Tous
À suivre
À reverser
Sans bien
Archivés
```

---

## 9. Ligne de résultats

La ligne pédagogique permanente est interdite.

À supprimer :

```txt
9 résultats · cliquez sur une ligne pour ouvrir la fiche propriétaire.
```

Pourquoi :

```txt
ça alourdit l’interface
ça donne un aspect vieux logiciel
ça répète une interaction évidente
```

Alternative :

```txt
mettre le compteur dans la chip Tous
utiliser les empty states pour expliquer
afficher une aide seulement si l’utilisateur est bloqué
```

---

## 10. Bouton Colonnes

`Colonnes` est desktop-first.

Il est autorisé sur desktop pour les tableaux denses.

Sur mobile :

```txt
caché
ou placé dans Options / Plus
```

Il ne doit pas apparaître comme action principale si la page mobile utilise des cartes.

---

## 11. Bottom sheet filtres mobile

Le bottom sheet actuel est une bonne base.

Norme :

```txt
handle en haut
titre court : Filtres Bailleurs
sous-texte : Affinez la liste sans quitter la page.
contenu scrollable
footer sticky : Réinitialiser / Appliquer
safe-area bottom
```

Hauteur :

```txt
max 75–80vh
scroll interne si nécessaire
```

Le sheet ne doit pas devenir une page entière sauf besoin exceptionnel.

---

## 12. Organisation des filtres avancés

Les filtres avancés doivent être regroupés par logique métier.

Exemple Bailleurs :

```txt
Statut
- Actifs
- Résiliés / suspendus

Suivi financier
- Avec reliquats
- Sans reliquats
- À reverser

Portefeuille
- Avec biens
- Sans biens

Commission
- Commission élevée
```

Sur l’écran principal, on ne montre pas tout.

---

# Norme par page

## Bailleurs

Problème actuel : toolbar trop collée au tableau, phrase pédagogique inutile, filtre trop chargé.

Cible :

```txt
[Rechercher propriétaire, téléphone, email...] [Tous les statuts] [Tous les profils] [Colonnes]

[Tous] [À suivre] [À reverser] [Sans bien]
```

Mobile :

```txt
[Recherche] [Filtres]
[Tous] [À suivre] [À reverser] [Sans bien]
```

---

## Biens & patrimoine

Le switch `Biens / Unités locatives` est à conserver, mais il doit être traité comme un vrai switch de vue.

Cible :

```txt
[Biens] [Unités locatives]
[Rechercher bien, adresse, bailleur...] [Tous les bailleurs] [Tous les statuts] [Colonnes]

[Tous] [Occupés] [Vacants] [Avec reliquats]
```

Mobile :

```txt
[Biens] [Unités]
[Recherche] [Filtres]
[Tous] [Occupés] [Vacants] [Reliquats]
```

---

## Locations

Cible :

```txt
[Rechercher locataire, bien, référence...] [Tous les propriétaires] [Tous les biens] [Période] [Colonnes]

[Toutes] [Actives] [Expirées] [Résiliées]
```

Mobile :

```txt
[Recherche] [Filtres]
[Toutes] [Actives] [Expirées] [Résiliées]
```

---

## Encaissements

Bonne base actuelle.

À garder, mais uniformiser les chips en pills Documents.

Cible :

```txt
[Rechercher paiement, locataire, référence...] [Mois en cours] [Tous les bailleurs] [Colonnes]

[Tous] [Soldés] [Partiels] [Avances] [Annulés]
```

---

## Créances à recouvrer

Bonne structure actuelle, mais placeholder trop vague.

Cible :

```txt
[Rechercher locataire, unité, échéance...] [Mois en cours] [Tous les bailleurs] [Colonnes]

[Toutes] [En retard] [Partiels] [À venir]
```

---

## Dépenses

Propre mais trop froide. Ajouter des chips métier.

Cible :

```txt
[Rechercher dépense, bien, fournisseur...] [Mois en cours] [Catégories] [Affectations] [Colonnes]

[Toutes] [Agence] [Bailleurs] [À vérifier]
```

---

## Documents

Référence principale.

À garder :

```txt
[Rechercher document, référence, locataire...] [Tous les documents] [Tous les statuts]

[Tous] [Quittances] [Contrats] [Mandats] [Rapports] [Sans QR]
```

---

# Règles responsive strictes

## Desktop

```txt
toolbar décollée du tableau
recherche dominante
filtres alignés
chips sous la recherche si utiles
Colonnes visible uniquement si tableau
```

## Mobile

```txt
recherche pleine largeur ou recherche + bouton Filtres
2 filtres visibles maximum
chips arrondies type Documents
scroll horizontal uniquement sur les chips
aucun scroll horizontal global
pas de bouton Colonnes principal
bottom sheet propre et scrollable
```

---

# Interdits définitifs

```txt
toolbar collée au tableau
ligne “cliquez sur une ligne”
placeholder vague “Rechercher...”
trop de filtres visibles
chips en underline
chips carrées
chips trop longues
Colonnes visible sur mobile cartes
bottom sheet trop long sans regroupement
scroll horizontal global
```

---

# Composants cibles à créer

À terme, il faut standardiser avec :

```txt
PremiumToolbar
PremiumSearchInput
PremiumFilterSelect
PremiumFilterButton
PremiumQuickChips
PremiumFilterSheet
PremiumViewSwitcher
```

Props minimales :

```ts
type QuickChip = {
  label: string;
  count?: number;
  active?: boolean;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  onClick: () => void;
};

type PremiumToolbarProps = {
  searchValue: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  filters?: React.ReactNode;
  quickChips?: QuickChip[];
  viewSwitcher?: React.ReactNode;
  showColumnsButton?: boolean;
  onOpenFilters?: () => void;
  onOpenColumns?: () => void;
};
```

---

# Phrase finale

```txt
Une toolbar Samay Këur doit rester calme, claire et utile.
Elle donne accès aux bons filtres sans transformer la page en panneau d’administration.
```

----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------


# Charte Tableaux Desktop — Samay Këur

## Principe général

Les tableaux desktop de Samay Këur doivent suivre une logique unique :

**Desktop = tableau dense + drawer métier.**

Le tableau sert à comparer rapidement les dossiers.
Le drawer sert à comprendre, agir, consulter les détails et faire les actions sensibles.

On ne doit pas essayer de tout mettre dans le tableau. Un bon tableau premium montre les bonnes informations au bon endroit, sans surcharge.

---

## 1. Structure standard

Chaque page de données doit suivre cette structure :

```txt
Toolbar détachée
↓
Tableau desktop
↓
Drawer métier à droite si une ligne est sélectionnée
```

La toolbar ne doit pas être collée au tableau.
Elle doit être dans son propre bloc premium, avec une marge claire.

---

## 2. Tableau sans drawer ouvert

Quand aucun drawer n’est ouvert, le tableau peut afficher plus d’informations.

Structure cible :

```txt
Colonne 1 : Identité principale
Colonne 2 : Contexte métier
Colonne 3 : Période / référence / date utile
Colonne 4 : Montant ou indicateur principal
Colonne 5 : Statut
Colonne 6 : Preuve / date / action secondaire
```

Règle : ne pas dépasser 6 à 7 colonnes vraiment utiles.
Au-delà, le tableau donne une impression d’outil administratif lourd au lieu d’un SaaS premium.

---

## 3. Tableau avec drawer ouvert

Quand le drawer est ouvert, le tableau doit devenir plus compact.

Structure cible :

```txt
Colonne 1 : Identité enrichie
Colonne 2 : Indicateur principal
Colonne 3 : Statut
Colonne 4 : Date ou montant secondaire
```

Ou, selon la page :

```txt
Identité | Période | Statut | Montant | Date
```

La première cellule doit récupérer une partie des informations masquées, mais sans devenir surchargée.

Exemple correct :

```txt
Quittance — Abou Diallo
Appartement F4 · juin 2026 · Réf. QIT-202606...
```

Exemple à éviter :

```txt
Quittance — Abou Diallo
Abou Diallo · Appartement F4 · juin 2026
```

La deuxième ligne ne doit pas répéter le titre.
Elle doit ajouter du contexte utile.

---

## 4. Règle obligatoire : alignement header / contenu

Chaque titre de colonne visible doit avoir un contenu visible aligné dessous.

Erreur à corriger sur Locations avec drawer ouvert :

```txt
Header visible : Propriétaire
Contenu masqué : aucun propriétaire affiché
```

Cela crée un décalage visuel et donne l’impression que le tableau est cassé.

Règle :

```txt
Si une colonne est masquée en contenu, son header doit aussi être masqué.
Si un header reste visible, le contenu correspondant doit rester visible.
```

Aucun tableau ne doit afficher un titre de colonne sans cellules correspondantes.

---

## 5. Icônes dans les headers de colonnes

Les icônes dans les titres de colonnes doivent être conservées, mais avec une règle claire.

Décision :

```txt
Les headers peuvent avoir des icônes discrètes.
Mais toutes les pages doivent suivre la même logique.
```

Les icônes doivent être :

* petites ;
* légères ;
* en couleur secondaire ;
* alignées proprement avec le texte ;
* jamais dominantes ;
* jamais différentes d’une page à l’autre sans raison.

Bon exemple :

```txt
icône discrète + BAILLEUR
icône discrète + BIEN / UNITÉ
icône discrète + LOYER
icône discrète + STATUT
```

Mauvais exemple :

```txt
certaines colonnes avec icône,
d’autres sans icône,
sans logique claire.
```

La norme cible est donc :

```txt
Headers avec icônes discrètes quand l’icône aide à scanner la colonne.
Même style d’icône partout.
Même taille partout.
Même couleur partout.
```

---

## 6. Première cellule : identité principale

La première cellule est la plus importante du tableau.

Elle doit contenir :

```txt
Titre fort
Sous-texte métier court
Référence discrète si utile
```

Exemples :

### Bailleurs

```txt
Modou Wane
12 unités · net positif
```

### Biens

```txt
Keur modou
Ouakam · 12 unités
```

### Locations

```txt
Abou Diallo
Appartement F4 · Keur modou
```

### Créances

```txt
Mouhamed Diop
Chambre + SDB · juin 2026
```

### Dépenses

```txt
Facture eau
Keur modou · 18/06/2026
```

### Documents

```txt
Quittance — Abou Diallo
Appartement F4 · juin 2026
```

---

## 7. Alignement des colonnes

Règles d’alignement :

```txt
Texte métier : aligné à gauche
Montants : alignés à droite
Dates : alignées à droite ou centrées selon la page
Statuts : alignés proprement dans leur colonne
Actions : à droite, mais discrètes
```

Les colonnes financières doivent être impeccables.

Sur Bailleurs, les colonnes `Reliquats` et `Net` doivent être alignées comme des colonnes de chiffres, pas comme du texte libre.

---

## 8. Actions en ligne

La colonne `Actions` ne doit pas dominer le tableau.

Règle :

```txt
Clic sur ligne = ouvrir le drawer
Chevron discret = indique que la ligne est ouvrable
Menu “...” = uniquement si actions rapides vraiment nécessaires
```

Pas besoin d’un gros header `Actions` partout.

Sur la majorité des pages, le drawer doit porter les vraies actions.

---

## 9. Ligne sélectionnée

Norme de sélection :

```txt
Fond vert très léger
Bord gauche vert premium 2px ou 3px
Texte inchangé
Pas de surbrillance agressive
```

La sélection doit être visible, mais calme.

Le beige ne doit pas être utilisé partout sans logique, sinon on ne distingue plus :

* hover ;
* sélection ;
* alternance de ligne ;
* état spécial.

---

## 10. Hauteur des lignes

Norme :

```txt
Table dense : 56–64px
Table riche avec avatar : 64–72px
```

Une ligne ne doit pas être haute sans raison.
La densité doit rester premium, pas vide.

---

## 11. Colonnes recommandées par page

### Bailleurs

Drawer fermé :

```txt
Bailleur | Biens | Unités | Reliquats | Net | Statut
```

Drawer ouvert :

```txt
Bailleur enrichi | Reliquats | Net
```

Téléphone et commission doivent surtout vivre dans le drawer.
Ils peuvent exister dans la table complète, mais ne doivent pas dominer.

---

### Biens & patrimoine

Drawer fermé :

```txt
Bien | Bailleur | Unités | Occupation | Loyer attendu | Reliquats | Statut
```

Drawer ouvert :

```txt
Bien enrichi | Occupation | Reliquats | Statut
```

La première cellule doit porter :

```txt
Nom du bien
Quartier / adresse courte · type
```

---

### Locations

Drawer fermé :

```txt
Locataire | Bien / unité | Propriétaire | Loyer | Période | Statut
```

Drawer ouvert :

```txt
Locataire enrichi | Loyer | Période | Statut
```

Important :

```txt
Si Propriétaire est masqué en contenu, le header Propriétaire doit disparaître aussi.
```

La table ne doit jamais afficher un header `Propriétaire` vide.

La première cellule peut porter :

```txt
Locataire
Bien / unité · propriétaire si la colonne propriétaire est masquée
```

---

### Encaissements

Drawer fermé :

```txt
Locataire | Bien / unité | Période | Montant reçu | Reliquat | Date | Statut
```

Drawer ouvert :

```txt
Locataire enrichi | Montant reçu | Reliquat | Statut
```

Encaissements doit servir de référence pour les tableaux financiers.

---

### Créances à recouvrer

Drawer fermé :

```txt
Locataire | Logement | Bailleur | Mois | Statut | Encaissé | Montant dû
```

Drawer ouvert :

```txt
Locataire enrichi | Statut | Encaissé | Montant dû
```

`Montant dû` doit être la donnée forte.
Le téléphone ne doit pas dominer le tableau. Il doit plutôt être dans le drawer.

---

### Dépenses

Drawer fermé :

```txt
Dépense | Affectation | Montant | Date | Statut
```

Drawer ouvert :

```txt
Dépense enrichie | Montant | Statut
```

La table Dépenses ne doit pas commencer par `Date`.

Elle doit commencer par l’objet métier :

```txt
Facture eau
Keur modou · 18/06/2026
```

---

### Documents

Drawer fermé :

```txt
Document | Contexte | Période | Statut | Preuve | Date
```

Drawer ouvert :

```txt
Document enrichi | Période | Statut | Preuve | Date
```

Documents est une bonne référence pour le comportement avec drawer ouvert.

---

## 12. Priorités de correction

### P0 — À corriger en premier

```txt
- Locations : header Propriétaire visible alors que le contenu est masqué avec drawer ouvert.
- Dépenses : première colonne doit devenir Dépense, pas Date.
- Harmoniser les icônes discrètes dans les headers.
- Corriger les colonnes qui perdent trop d’informations avec drawer ouvert.
- Aligner proprement les montants dans toutes les pages.
```

### P1 — Harmonisation premium

```txt
- Uniformiser le hover des lignes.
- Uniformiser la ligne sélectionnée.
- Réduire les colonnes Actions inutiles.
- Harmoniser badges statut / badges financiers.
- Rendre les tables plus denses sans les rendre froides.
```

### P2 — Finition

```txt
- Troncature homogène des longues références.
- Chevrons discrets partout.
- Empty rows et loading rows standardisés.
- Responsive desktop/tablet mieux séparé.
```

---

## Décision verrouillée

La norme Samay Këur est :

```txt
Le tableau compare.
Le drawer explique et permet d’agir.
La première cellule porte l’identité.
Les colonnes visibles doivent toujours correspondre aux headers visibles.
Les icônes de headers sont autorisées, mais discrètes et uniformes.
```

Un tableau premium ne montre pas tout.
Il montre exactement ce qu’il faut pour décider vite.



------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------



# Charte Cartes Mobile — Samay Këur

## Principe général

Sur mobile, on ne doit pas compacter le tableau desktop.
On doit créer une vraie carte mobile pensée pour le pouce, la lecture rapide et le drawer.

```txt
Mobile = carte métier claire + drawer pour les détails.
```

La carte ne doit pas tout afficher.
Elle doit permettre de reconnaître l’élément, comprendre son état et ouvrir le drawer sans mauvais clic.

---

## 1. Structure standard d’une carte mobile

Structure cible :

```txt
Ligne 1 : identité principale + statut
Ligne 2 : contexte métier court
Ligne 3 : indicateur principal
Ligne 4 : métadonnées secondaires discrètes
```

Exemple :

```txt
Fatoumata Ly Dème                    Soldé
Keur modou · Appartement F4
200 000 F CFA                        juin 2026
Espèces · 15/06/2026
```

Ou pour un document :

```txt
Quittance — Abou Diallo              Actif
Appartement F4 · juin 2026
Vérifiable QR · Généré
Réf. QIT-202606...
```

---

## 2. Carte entièrement cliquable

La carte entière doit ouvrir le drawer.

Règle :

```txt
Un tap sur la carte = ouvrir le drawer.
```

À éviter :

```txt
Téléphone cliquable dans la carte
Montant cliquable
Mini-zone cliquable interne
Boutons secondaires dans la carte
```

Les actions sensibles doivent être dans le drawer :

```txt
Appeler
WhatsApp
Ouvrir document
Télécharger
Archiver
Encaisser
Modifier
```

Pourquoi : sur mobile, les zones cliquables internes créent des mauvais clics pendant le scroll.
---

## 2B. Règle officielle de respiration drawer desktop

Sur desktop, aucun drawer ne doit être collé au bord droit de l’écran.

Norme obligatoire :
- le drawer garde une marge extérieure droite visible ;
- le drawer garde une marge haute cohérente avec le contenu principal ;
- le drawer doit ressembler à une colonne premium intégrée, pas à un panneau plaqué contre le navigateur ;
- toutes les pages doivent utiliser la même logique de respiration.

Valeurs recommandées :
- marge droite : 16px à 24px ;
- marge haute : 16px à 24px ;
- radius : identique aux grandes cards premium ;
- shadow : douce, jamais agressive.

Interdit :
- drawer flush right ;
- drawer sans marge ;
- drawer collé à la bordure navigateur ;
- drawer avec une marge différente selon la page sans raison métier.
---

## 3. Statut toujours en haut à droite

Chaque carte doit avoir un statut clair en haut à droite.

Exemples :

```txt
Actif
Louée
En retard
Partiel
Soldé
Enregistrée
À classer
Archivé
Vérifiable QR
```

Le statut doit être :

* petit ;
* lisible ;
* coloré selon le sens métier ;
* toujours au même endroit ;
* jamais noyé dans les métadonnées.

---

## 4. Icône ou avatar à gauche

Les cartes d’entités peuvent avoir une icône ou un avatar à gauche.

À utiliser pour :

```txt
Bailleurs
Biens
Unités
Locations
Documents
```

À éviter sur les cartes purement financières si cela n’apporte rien.

Exemples :

```txt
Bailleur = initiales
Bien = icône immeuble / maison
Document = icône document / rapport
```

La taille doit rester stable :

```txt
40px à 44px
```

---

## 5. Hiérarchie typographique

La carte mobile ne doit pas avoir tout en gras.

Norme :

```txt
Titre principal : fort
Contexte : moyen
Montant principal : fort + couleur métier si utile
Métadonnées : petites et calmes
```

À éviter :

```txt
Tout en noir très gras
Tous les montants agressifs
Trop de capitales
Trop de badges
```

Le gras doit servir à guider l’œil, pas à crier partout.

---

## 6. Couleurs des montants

Règle simple :

```txt
Montant encaissé / positif : vert profond
Montant dû / retard : rouge maîtrisé
Montant neutre : noir profond
Commission / part agence : ambre maîtrisé si utile
```

Mais la couleur doit rester maîtrisée.
Pas de saturation agressive.

---

## 7. Mini-blocs internes

Les mini-blocs du type :

```txt
Biens 0
Reliquat 0 F CFA
```

sont acceptables seulement si la page en a vraiment besoin.

Mais ils doivent être utilisés avec prudence.

Problème actuel sur Bailleurs :

```txt
Les mini-blocs “Biens” et “Reliquat” prennent beaucoup de place
et donnent un rendu un peu administratif.
```

Norme cible :

```txt
Préférer une ligne compacte :
Net 0 F CFA · 0 bien · Reliquat 0 F CFA
```

Ou :

```txt
Net 0 F CFA
0 bien · Reliquat 0 F CFA
```

Les mini-blocs doivent être réservés aux cas où deux chiffres doivent vraiment être comparés rapidement.

---

## 8. Bailleurs — carte cible

Problème actuel :

* téléphone trop visible ;
* mini-blocs un peu lourds ;
* résultat texte “9 résultats…” inutile en mobile ;
* carte correcte mais encore trop administrative.

Structure cible :

```txt
Modou Wane                         Actif
12 unités · 1 bien
Net 42,5 M F CFA
Reliquat 0 F CFA
```

Le téléphone doit être dans le drawer, pas dans la carte.

---

## 9. Biens & patrimoine — carte cible

Les cartes Biens sont parmi les meilleures bases.

À garder :

* icône à gauche ;
* statut à droite ;
* nom du bien fort ;
* contexte quartier / unités / occupation ;
* loyer visible.

À améliorer :

* éviter trop de mini-blocs ;
* harmoniser avec les autres pages ;
* garder les montants moins agressifs.

Structure cible :

```txt
Keur Wane                           Actif
Ouakam · 2 unités · 100% occupé
480 000 F CFA / mois
Reliquat 0 F CFA
```

Pour une unité :

```txt
Appartement F5 · 06                 En retard
Le medinois · Seye Bane
700 000 F CFA / mois
Reliquat 100 000 F CFA
```

---

## 10. Locations — carte cible

Problème actuel :

* téléphone visible dans la carte ;
* structure un peu trop simple ;
* manque de contexte propriétaire / période ;
* ressemble moins aux autres cartes portefeuille.

Structure cible :

```txt
Abou Diallo                         Actif
Keur thiam · Appartement
176 600 F CFA / mois
Contrat actif · jusqu’au 13/06/2028
```

Le téléphone reste dans le drawer.

---

## 11. Encaissements — carte cible

Les cartes Encaissements sont propres et lisibles.

À garder :

* montant principal visible ;
* statut en haut à droite ;
* date et mode de paiement ;
* carte peu chargée.

À harmoniser :

* ajouter une structure proche des autres pages ;
* éviter que la page finance ait un style trop différent du portefeuille.

Structure cible :

```txt
Fatoumata Ly Dème                   Soldé
Keur modou · Appartement F4
200 000 F CFA                       juin 2026
Espèces · 15/06/2026
```

---

## 12. Créances à recouvrer — carte cible

Les cartes Créances sont efficaces, mais très rouges.
C’est normal pour l’alerte, mais il faut rester premium.

Structure cible :

```txt
Mouhamed Diop                       En retard
Keur modou · Chambre + SDB
700 000 F CFA dus                   juin 2026
0 F CFA encaissé
```

Règle :

```txt
Montant dû = rouge
Statut = rouge clair
Le reste = calme
```

Ne pas mettre trop d’éléments rouges en même temps.

---

## 13. Dépenses — carte cible

Problème actuel :

* carte trop pauvre ;
* pas de statut visible en haut à droite ;
* catégorie et description peu structurées ;
* donne moins premium que les autres.

Structure cible :

```txt
Eau                                 Enregistrée
Keur modou · Général
50 000 F CFA
18/06/2026
```

Ou :

```txt
Prime de transport                  Enregistrée
Général · Exploitation
20 000 F CFA
15/06/2026
```

La carte Dépense doit commencer par l’objet métier, pas uniquement par une date ou un montant.

---

## 14. Documents — carte cible

Documents est riche, mais trop chargé sur mobile.

Problèmes actuels :

* trop de badges ;
* date, période et version parfois visibles ensemble ;
* référence technique très présente ;
* carte plus dense que les autres.

À garder :

* icône document ;
* type en petit label ;
* titre métier ;
* contexte ;
* statut QR.

À simplifier :

```txt
Rapport bailleur — Modou Wane       Vérifiable QR
juin 2026 · v6
Généré · Actif
Réf. RBL-2026...
```

Pour une quittance :

```txt
Quittance — Abou Diallo             Vérifiable QR
Appartement F4 · juin 2026
Généré · Actif
Réf. QIT-202606...
```

Ne pas afficher deux fois le mois.
Ne pas afficher trop de micro-infos sur la même ligne.

---

## 15. Nombre d’informations maximum

Une carte mobile ne doit pas dépasser :

```txt
1 titre principal
1 statut principal
1 ligne contexte
1 indicateur fort
1 ligne secondaire
```

Maximum recommandé :

```txt
5 informations visibles
```

Tout le reste va dans le drawer.

---

## 16. Hauteur des cartes

Norme :

```txt
Carte simple : 96–112px
Carte riche : 120–140px
Carte document : 128–150px maximum
```

Au-delà, la page devient trop longue.

Documents peut être légèrement plus haut, mais pas devenir une fiche complète.

---

## 17. Espacement et bottom nav

Chaque liste mobile doit avoir un padding bas suffisant :

```txt
padding-bottom: bottom nav + marge de respiration
```

Mais il ne faut pas créer un grand vide blanc inutile en fin de page.

Norme :

```txt
pb-24 ou pb-[calc(6rem+env(safe-area-inset-bottom))]
```

À ajuster selon la bottom nav réelle.

---

## 18. Règles anti-débordement mobile

Obligatoire sur toutes les cartes :

```txt
min-w-0
max-w-full
truncate ou line-clamp
break-words sur références longues
aucun bouton interne qui force la largeur
```

Les noms longs, références longues et montants longs ne doivent jamais provoquer de scroll horizontal.

---

## 19. Différence desktop / mobile

Ne pas recopier le tableau desktop en carte mobile.

Desktop :

```txt
Comparaison rapide en colonnes
```

Mobile :

```txt
Reconnaissance rapide + ouverture drawer
```

La carte mobile doit avoir sa propre logique.

---

## 20. Décision verrouillée

La carte mobile Samay Këur doit être :

```txt
claire,
dense mais respirante,
entièrement cliquable,
sans actions accidentelles,
avec statut en haut à droite,
avec contexte court,
avec un seul indicateur principal fort.
```

Le drawer porte les détails.
La carte porte la décision rapide.



------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# CHARTE DRAWER OFFICIELLE — SAMAY KËUR

Objectif :
Tous les drawers de Samay Këur doivent donner la même impression produit : une fiche métier premium, claire, rapide à lire, utilisable comme vraie colonne de travail sur desktop et comme fiche plein écran maîtrisée sur mobile.

Le drawer n’est pas une simple modale.
C’est la fiche opérationnelle d’un élément sélectionné.

---

## 1. Principe général

Chaque drawer doit respecter cette logique :

- identifier rapidement l’élément ;
- montrer l’action principale ;
- afficher les informations métier essentielles ;
- donner accès aux documents / preuves / historique ;
- placer les actions dangereuses tout en bas ;
- ne jamais casser la lisibilité de la liste ou du tableau à gauche.

Le drawer doit être utile en moins de 5 secondes.

---

## 2. Positionnement desktop

Sur desktop, le drawer doit être une vraie colonne de travail à droite.

Norme desktop :

- drawer aligné à droite ;
- largeur stable entre 400px et 460px selon la page ;
- hauteur utile pleine ;
- marge en haut et à droite uniforme ;
- jamais collé brutalement au bord de l’écran ;
- fond clair premium ;
- radius visible ;
- bordure fine ;
- shadow douce ;
- scroll interne dans le drawer, pas sur toute la page si possible.

Règle d’espacement :

- top : 16px minimum ;
- right : 16px minimum ;
- bottom : 16px si le drawer n’est pas plein écran ;
- gap entre tableau et drawer : 16px à 24px.

À éviter :

- drawer collé au bord droit ;
- drawer qui commence trop bas sans raison ;
- drawer qui flotte comme une carte isolée ;
- drawer qui écrase le tableau au lieu de créer un split-view propre.

---

## 3. Positionnement mobile

Sur mobile, le drawer doit devenir une fiche plein écran ou quasi plein écran.

Norme mobile :

- largeur 100% ;
- hauteur proche de 100dvh ;
- pas de scroll horizontal ;
- header sticky ;
- contenu scrollable ;
- padding-bottom suffisant pour ne jamais être caché par la bottom nav ;
- boutons touch-friendly ;
- titre limité à 2 lignes maximum ;
- actions dangereuses en bas.

Safe area mobile obligatoire :

- padding-bottom minimum : bottom nav + 24px ;
- aucun bouton important ne doit être collé au bas de l’écran ;
- aucun contenu ne doit être masqué par la navigation mobile.

---

## 4. Header du drawer

Tous les drawers doivent avoir un header compact, sticky et cohérent.

Structure standard :

1. Eyebrow métier
2. Titre principal
3. Badge statut principal
4. Contexte court
5. Bouton fermer

Exemples :

- FICHE PROPRIÉTAIRE
- FICHE LOCATION
- PAIEMENT DU 15/06/2026
- CRÉANCE À RECOUVRER
- DÉPENSE ENREGISTRÉE
- RAPPORT BAILLEUR

Règles :

- le header reste visible au scroll ;
- le bouton fermer est toujours en haut à droite ;
- le titre est line-clamp-2 maximum ;
- le header ne doit pas contenir trop d’informations ;
- les informations longues descendent dans le résumé.

À éviter :

- header énorme ;
- header non sticky sur certaines pages ;
- titre qui prend 3 ou 4 lignes ;
- statut perdu dans le contenu ;
- bouton fermer différent selon les pages.

---

## 5. Typographie

Règle importante :
Les pages peuvent utiliser une police serif premium pour les grands titres.
Les drawers doivent utiliser une police sans-serif forte, claire et opérationnelle.

Norme :

- Page title : serif premium autorisée.
- Drawer title : sans-serif bold.
- Montant principal : sans-serif extra-bold.
- Eyebrow : uppercase, tracking large, petit format.
- Section title : uppercase, tracking, couleur muted.
- Label : petit, lisible, semi-bold.
- Valeur : medium ou bold selon importance.

À éviter :

- trop de serif dans les drawers ;
- gras trop agressif partout ;
- labels trop grands ;
- valeurs importantes noyées dans le texte.

---

## 6. Ordre standard des sections

Ordre général recommandé :

1. Header compact sticky
2. Action principale
3. Résumé métier
4. Contexte / affectation
5. Documents / preuves
6. Historique / activité
7. Actions secondaires
8. Zone danger tout en bas

La zone danger ne doit jamais dominer le premier écran, sauf cas exceptionnel.

---

## 7. Actions

Chaque drawer doit distinguer clairement les types d’actions.

Action primaire :

- une seule action principale forte ;
- bouton vert plein ;
- visible dans le haut ;
- exemple : Encaisser ce loyer, Voir quittance, Ouvrir, Rapport PDF.

Actions secondaires :

- boutons outline ou blancs ;
- rangées compactes ;
- exemple : Paiements, Documents, Biens, Copier référence.

Actions de preuve :

- spécifiques aux documents ;
- doivent rester compactes ;
- exemple : Vérifier QR, Copier lien, Copier réf.

Actions dangereuses :

- rouge ;
- toujours séparées ;
- toujours vers le bas ;
- exemple : Résilier, Annuler, Supprimer.

---

## 8. KPI dans drawer

Les KPI dans un drawer doivent rester limités.

Norme :

- maximum 4 KPI visibles directement ;
- ne pas transformer le drawer en tableau de bord ;
- les KPI doivent être liés à l’élément sélectionné ;
- les KPI secondaires doivent aller dans un onglet ou une section détail.

Exemples :

Bailleur :
- Loyers
- Reliquats
- Net
- Locations

Bien :
- Unités
- Occupées
- Loyers
- Reliquats

Location :
- Loyer mensuel
- Statut
- Prochain paiement
- Reliquat

Paiement :
- Montant reçu
- Reliquat
- Commission agence
- Net bailleur

---

## 9. Sections internes

Les sections doivent avoir une grammaire commune :

- carte claire ;
- radius 14px à 18px ;
- bordure fine ;
- fond blanc/crème ;
- titre uppercase discret ;
- lignes label / valeur alignées ;
- pas de section vide ;
- pas de “—” inutile si une phrase claire est meilleure.

Exemple préférable :

“ Aucun justificatif ajouté ”
avec bouton “Ajouter un justificatif”

plutôt que :

“ Justificatif : — ”

---

## 10. Tables avec drawer ouvert

Quand le drawer est ouvert, le tableau à gauche doit rester propre.

Règles :

- les colonnes visibles doivent rester alignées ;
- aucun titre de colonne ne doit rester si son contenu est masqué ;
- aucune cellule vide ne doit créer un décalage ;
- les informations masquées doivent être fusionnées proprement dans la cellule principale.

Exemple correct :

Colonne principale :
Abou Diallo
Keur modou · Appartement F4 · Modou Wane

Colonnes restantes :
Loyer · Statut · Date

Exemple interdit :

Header “Propriétaire” visible
mais contenu propriétaire absent dans les lignes.

---

## 11. Icônes dans les colonnes et sections

Les icônes sont autorisées, mais doivent être discrètes.

Norme :

- taille 14px environ ;
- couleur muted ;
- même alignement partout ;
- même spacing entre icône et texte ;
- jamais d’icône décorative trop dominante.

Les titres de colonne peuvent avoir des icônes.
Le problème n’est pas l’icône.
Le problème est l’incohérence.

---

## 12. Variantes par type de drawer

### Drawer Bailleur

Objectif :
fiche propriétaire + performance portefeuille.

Structure recommandée :

1. Header propriétaire
2. Résumé portefeuille
3. Action principale : Rapport PDF
4. KPI essentiels
5. Tabs : Vue d’ensemble, Rapports, Biens, Paiements, Documents
6. Activité récente
7. Actions secondaires
8. Danger tout en bas

À corriger :
le danger ne doit pas être trop haut.
les KPI doivent être limités.

---

### Drawer Bien

Objectif :
fiche patrimoine claire.

Structure recommandée :

1. Header bien
2. KPI patrimoine
3. Informations
4. Actions principales
5. Gestion
6. Tabs : Unités, Locations, Documents

Référence actuelle :
le drawer Bien est une bonne base de simplicité.

---

### Drawer Unité

Objectif :
état d’occupation et lien location.

Structure recommandée :

1. Header unité
2. Résumé occupation
3. Occupation actuelle
4. Actions principales
5. Gestion
6. Paiements / Documents

---

### Drawer Location

Objectif :
fiche bail / occupation.

Structure recommandée :

1. Header location
2. Résumé opérationnel
3. Documents principaux
4. Gestion
5. Paiements
6. Historique
7. Danger tout en bas

À corriger :
le résumé doit remonter avant les actions secondaires.
la zone danger doit descendre.

---

### Drawer Paiement

Objectif :
preuve d’encaissement et impact financier.

Structure recommandée :

1. Header paiement avec montant
2. Action principale : Voir quittance
3. Résumé paiement
4. Affectation
5. Impact financier
6. Documents liés
7. Historique
8. Actions contrôlées

Référence actuelle :
le drawer Paiement est une très bonne base pour les drawers financiers.

---

### Drawer Créance

Objectif :
recouvrer vite et sans ambiguïté.

Structure recommandée :

1. Header créance avec montant dû
2. Action principale : Encaisser ce loyer
3. Résumé créance
4. Affectation
5. Contact
6. Traçabilité certifiée

Référence actuelle :
le drawer Créance est une bonne base actionnelle.

---

### Drawer Dépense

Objectif :
contrôle d’une dépense et impact financier.

Structure recommandée :

1. Header dépense avec montant
2. Résumé
3. Affectation & description
4. Justificatif
5. Impact financier
6. Historique
7. Actions contrôlées

À corriger :
si aucun justificatif, proposer une action claire au lieu d’un état vide trop passif.

---

### Drawer Document

Objectif :
preuve documentaire, registre et contexte métier.

Structure recommandée :

1. Header document compact
2. Actions principales : Ouvrir / Télécharger
3. Preuve et registre
4. Actions de preuve
5. Contexte métier
6. Fiche technique

À corriger :
le drawer doit avoir la même autorité visuelle qu’une vraie colonne de travail desktop.

---

## 13. États interdits

Interdire :

- drawer collé au bord droit sans marge ;
- header non sticky ;
- titre qui déborde ;
- section danger trop haute ;
- trop de KPI dans le drawer ;
- boutons massifs répétés ;
- section vide ;
- colonnes de tableau désalignées quand drawer ouvert ;
- mobile avec bouton caché par bottom nav ;
- drawer qui change totalement de logique selon la page.

---

## 14. Critère de validation

Un drawer est validé seulement si cette phrase est vraie :

“L’utilisateur comprend l’élément sélectionné, peut agir dessus, consulter son contexte et revenir à la liste sans perdre son orientation.”

Phrase finale :

Samay Këur ne doit pas ouvrir des panneaux.
Samay Këur doit ouvrir des fiches métier.

------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------


# Charte officielle — Wizards Samay Këur

## 0. Objectif

Les wizards Samay Këur doivent transformer les actions complexes en parcours guidés, premium et sécurisés.

Ils ne doivent pas ressembler à de longues modales administratives. Ils doivent donner l’impression d’un workflow maîtrisé, clair, rapide et fiable.

Règle centrale :

```txt
Un wizard = une action métier découpée proprement.
Une étape = une intention claire.
Mobile ≠ desktop compressé.
```

---

# 1. Principe général

Un wizard Samay Këur doit toujours respecter 5 principes :

```txt
1. Guidage
L’utilisateur sait où il est, ce qu’il doit faire, et ce qui va se passer ensuite.

2. Compacité
Chaque étape contient uniquement ce qui est nécessaire.

3. Sécurité métier
Les mutations sensibles sont confirmées, résumées et traçables.

4. Cohérence visuelle
Tous les wizards partagent le même squelette, les mêmes boutons, les mêmes inputs et les mêmes règles responsive.

5. Premium maîtrisé
Liquid glass, flou, profondeur et surfaces élégantes sont utilisés pour l’interface, jamais au détriment de la lisibilité.
```

---

# 2. Structure officielle

Tous les wizards doivent suivre cette structure :

```txt
WizardShell
├── Overlay / backdrop
├── WizardPanel
│   ├── WizardHeader
│   ├── WizardStepper
│   ├── WizardBody
│   └── WizardFooter
└── Safe areas
```

Sur desktop : modal centrée, stable, avec largeur adaptée au contenu.

Sur mobile : bottom sheet / modal basse, pleine largeur contrôlée, avec scroll interne propre.

---

# 3. Desktop — structure officielle

## 3.1 Format desktop

Sur desktop, un wizard doit être une vraie surface de travail, pas un petit formulaire perdu.

### Largeurs recommandées

```txt
Wizard simple : 640px à 720px
Wizard standard : 760px à 860px
Wizard riche : 900px à 1040px
Wizard très métier : jusqu’à 1120px, uniquement si nécessaire
```

Le wizard ne doit pas être trop vide. S’il reste beaucoup d’espace blanc, il faut soit réduire sa largeur/hauteur, soit ajouter un aperçu utile.

## 3.2 Position

```txt
Desktop :
- modal centrée
- overlay flouté
- panel arrondi
- shadow douce
- aucune bordure dure
- pas de scroll horizontal
```

## 3.3 Hauteur

Le wizard desktop doit avoir une hauteur adaptée :

```txt
min-height raisonnable
max-height: calc(100vh - 48px)
body scrollable si nécessaire
footer visible
```

Un wizard desktop ne doit pas donner une impression de page longue dans une modale.

---

# 4. Mobile — structure officielle

## 4.1 Format mobile

Sur mobile, le wizard doit être un bottom sheet premium.

```txt
Mobile :
- largeur 100%
- coins arrondis en haut
- handle visible
- overlay flouté
- corps scrollable
- footer sticky
- safe-area-bottom respecté
```

## 4.2 Cible de test

Le design doit être validé sur :

```txt
iPhone 12 Pro
iPhone 14 Pro Max
Android moyen format
```

L’iPhone 12 Pro est la référence minimale. Si ça passe seulement sur iPhone 14 Pro Max, ce n’est pas validé.

---

# 5. Header officiel

## 5.1 Desktop

Le header desktop doit contenir :

```txt
Marque / eyebrow : SAMAY KËUR
Titre du wizard
Description courte
Bouton fermer
```

Règles :

```txt
- titre fort
- description 1 à 2 lignes max
- bouton fermer aligné à droite
- logo discret
- padding stable
- pas de texte trop long
```

Exemple :

```txt
SAMAY KËUR
Nouveau bailleur
Créez une fiche propriétaire exploitable.
```

## 5.2 Mobile

Le header mobile doit être plus compact.

Règles :

```txt
- marque petite
- titre lisible
- description max 2 lignes
- bouton fermer visible
- pas de header trop haut
- pas de slogan inutile
```

Descriptions mobiles recommandées :

```txt
Nouveau bailleur
Créez une fiche propriétaire exploitable.

Nouveau bien
Renseignez les informations essentielles du bien.

Nouvelle unité locative
Définissez l’espace à louer et son loyer.

Nouvelle location
Créez une location complète et contrôlée.

Nouveau paiement
Enregistrez un encaissement contrôlé.

Nouvelle dépense
Qualifiez la charge, son affectation et sa preuve.

Ajouter un document
Ajoutez une preuve et classez-la dans son contexte métier.
```

---

# 6. Stepper officiel

## 6.1 Desktop

Le stepper desktop peut afficher les étapes sous forme de cartes horizontales.

Format :

```txt
Icône
ÉTAPE X
Nom de l’étape
Sous-label court optionnel
```

Exemple :

```txt
ÉTAPE 1
Identité

ÉTAPE 2
Gestion

ÉTAPE 3
Validation
```

Règles desktop :

```txt
- cartes alignées
- hauteur identique
- étape active très visible
- étape terminée en vert clair avec coche
- étape future sobre
- aucun texte tronqué
- pas de surcharge visuelle
```

## 6.2 Mobile

Le stepper mobile doit être différent du desktop.

Format officiel :

```txt
Icône
ÉTAPE X SUR Y
Nom court
Barre de progression
```

Règles mobile :

```txt
- pas de stepper desktop compressé
- pas de texte tronqué du type PAIEME... / VALIDA...
- pas de capsules trop larges
- nom d’étape court
- barre lisible
- hauteur réduite
```

Noms courts autorisés :

```txt
Identité
Gestion
Bien
Adresse
Unité
Loyer
Locataire
Contrat
Paiement
Nature
Affectation
Classement
Validation
Confirmation
```

---

# 7. Corps du wizard

## 7.1 Règle d’intention

Chaque étape doit répondre à une seule intention.

Exemples :

```txt
Étape Identité :
identifier la personne.

Étape Bien :
décrire le bien.

Étape Paiement :
saisir le montant réellement encaissé.

Étape Validation :
vérifier avant mutation.
```

## 7.2 Densité desktop

Sur desktop, une étape peut utiliser :

```txt
- grille 2 colonnes
- résumé latéral
- cartes de validation
- preview métier
```

Mais elle ne doit pas être vide.

Si une étape contient seulement 2 champs, ajouter éventuellement :

```txt
- aide contextuelle
- résumé sélectionné
- aperçu de l’impact
- mini-card métier
```

## 7.3 Densité mobile

Sur mobile :

```txt
- une colonne
- pas de champs côte à côte
- pas de longues cartes
- pas de contenu secondaire visible par défaut
- pas de mini-page dans une étape
```

Objectif mobile :

```txt
1 action principale
2 à 4 champs principaux
1 résumé compact maximum
CTA visible
```

---

# 8. Scroll et hauteur utile

## 8.1 Règle générale

Le scroll est autorisé, mais il doit être maîtrisé.

Un wizard n’est pas validé si :

```txt
- l’étape donne l’impression d’une page longue
- le footer masque du contenu
- les champs importants sont cachés derrière les boutons
- l’utilisateur doit scroller trop longtemps pour valider
```

## 8.2 Mobile

Sur mobile, le contenu doit avoir :

```txt
padding-bottom = hauteur footer + safe-area-bottom + 16px minimum
```

Le footer sticky ne doit jamais cacher :

```txt
- une carte
- un champ
- un résumé
- un message d’erreur
- une information de validation
```

## 8.3 Étapes longues

Si une étape devient longue, il faut appliquer une des solutions :

```txt
- masquer les champs conditionnels
- regrouper les détails secondaires
- utiliser un accordéon “Voir plus”
- déplacer des détails vers la validation
- réduire les textes
- transformer une étape en deux étapes si nécessaire
```

---

# 9. Footer officiel

## 9.1 Desktop

Footer desktop :

```txt
Retour / Annuler à gauche ou secondaire
Continuer / Créer / Enregistrer à droite
```

Règles :

```txt
- footer séparé du body
- fond légèrement glass ou ivoire
- CTA principal vert profond
- secondaire ghost
- disabled sobre
```

## 9.2 Mobile

Footer mobile :

```txt
CTA principal pleine largeur
Action secondaire dessous ou plus discrète
```

Règles :

```txt
- CTA principal visible
- texte sur une seule ligne
- bouton désactivé moins dominant
- safe-area-bottom respecté
- ne jamais masquer le contenu
```

Boutons principaux :

```txt
Continuer
Créer le bailleur
Créer le bien
Créer l’unité
Créer la location
Enregistrer le paiement
Enregistrer la dépense
Ajouter au coffre
```

Boutons secondaires :

```txt
Retour
Annuler
```

---

# 10. Inputs officiels

Les champs doivent être intelligents. On ne doit pas accepter n’importe quoi puis corriger après.

## 10.1 Montants

Champs concernés :

```txt
loyer
caution
montant encaissé
dépense
reliquat
montant attendu
commission calculée
```

Règles :

```txt
inputMode="numeric"
chiffres uniquement
pas de lettres
pas de caractères spéciaux inutiles
formatage visuel : 300 000
valeur interne : 300000
suffixe F CFA si pertinent
```

## 10.2 Téléphone

Règles :

```txt
inputMode="tel"
chiffres, espaces, + au début uniquement
interdire lettres
normalisation avant sauvegarde
```

## 10.3 Commission

Règles :

```txt
inputMode="decimal"
chiffres + virgule ou point
virgule convertie en point
min 0
max métier conseillé 100
suffixe % visible
```

## 10.4 Dates

Règles :

```txt
date picker ou composant contrôlé
pas de saisie libre hasardeuse
format affiché cohérent
pas de lettres
```

## 10.5 Numéro / code

Ne pas limiter aux chiffres.

Valeurs valides :

```txt
A1
F4
Boutique 3
RDC-01
Appartement F5 - 06
```

Règles :

```txt
alphanumérique autorisé
longueur limitée
trim automatique
pas de caractères dangereux
```

## 10.6 Nom / prénom

Règles :

```txt
lettres, espaces, tirets, apostrophes
refuser une valeur uniquement numérique
trim automatique
longueur minimale raisonnable
```

## 10.7 Référence transaction

Règles :

```txt
texte libre contrôlé
longueur maximale
trim automatique
placeholder court
```

---

# 11. Icônes dans les champs

Bug interdit :

```txt
icône loupe posée sur le texte
icône qui chevauche le placeholder
chevron mal aligné
```

Règle officielle :

```txt
icône gauche : left 14px
zone icône fixe
padding-left minimum 40px
alignement vertical parfait
texte jamais sous l’icône
```

À appliquer sur :

```txt
SearchInput
SmartCombobox
Select premium
MobileFilterSheet
Wizard fields
Document upload fields
```

---

# 12. Selects, combobox et dropdowns

## 12.1 Desktop

Sur desktop, utiliser un composant premium type SmartCombobox.

Règles :

```txt
- recherche possible si liste longue
- chevron aligné
- placeholder propre
- menu au-dessus des modales/tables/drawers
- pas de menu coupé par overflow-hidden
- z-index propre ou portal
```

## 12.2 Mobile

Sur mobile, les longues listes doivent ouvrir un bottom sheet.

Structure :

```txt
MobileSelectionSheet
├── handle
├── titre
├── champ recherche sticky si liste longue
├── options
└── fermeture claire
```

Règles :

```txt
- pas de dropdown desktop compressé
- pas d’option “Sélectionner un bien” cochée
- options lisibles
- tap confortable
- fermeture claire
```

Format d’option :

```txt
Nom principal
Contexte court
Badge si utile
```

Exemple :

```txt
Keur Alima
Leona · Dakar-Ouakam
Libre
```

---

# 13. Cartes de sélection

Les cartes de choix doivent rester compactes.

Format :

```txt
Icône
Titre
Description courte
```

État sélectionné :

```txt
fond vert clair
bordure verte
coche ou accent visible
titre renforcé
```

État non sélectionné :

```txt
fond clair
bordure discrète
texte secondaire
```

Interdit :

```txt
- descriptions longues
- cartes énormes
- deux paragraphes dans une carte
- sélection trop subtile
```

---

# 14. Validation finale

La validation finale doit répondre à 3 questions :

```txt
1. Qu’est-ce qui sera créé ou enregistré ?
2. Quelles sont les données clés ?
3. Quel est l’impact métier ?
```

Structure officielle :

```txt
Bloc validation finale
Carte résumé principal
Données clés
Impact métier
Message de sécurité / traçabilité
CTA final
```

Règles :

```txt
- pas de jargon technique
- pas de “API”, “RPC”, “Edge Function”, “token”
- pas trop de badges
- informations longues tronquées proprement
- pas de mosaïque excessive sur mobile
```

---

# 15. Liquid glass

Le liquid glass est validé comme langage premium, mais il doit être maîtrisé.

À utiliser sur :

```txt
overlay
bottom sheet
header de wizard
footer sticky
stepper
toasts
selection sheets
surfaces de navigation
```

À éviter sur :

```txt
données financières critiques
tableaux
KPI principaux
cartes très denses
champs partout
```

Règle :

```txt
Chrome UI = liquid glass possible
Data métier = lisibilité sobre
```

---

# 16. Wording officiel

Le wording doit être métier, pas technique.

Interdit côté utilisateur :

```txt
token
API
RPC
Edge Function
Supabase
transaction atomique
insert direct
update direct
objet
payload
```

Préférer :

```txt
code de sécurité
preuve enregistrée
traitement sécurisé
validation finale
registre documentaire
document vérifiable
fiche propriétaire
location
bien
unité
paiement
dépense
```

Remplacer :

```txt
contrat actif
```

par :

```txt
location active
```

sauf si on parle explicitement du document PDF de contrat.

---

# 17. Règles par wizard

## 17.1 Nouveau bailleur

Étapes recommandées :

```txt
1. Identité
- prénom
- nom
- téléphone
- email

2. Gestion
- adresse
- pièce d’identité
- commission
- début mandat / début gestion
- notes si nécessaire

3. Validation
- nom complet
- téléphone
- email
- adresse
- commission
- date de début
```

À corriger / verrouiller :

```txt
- description mobile plus courte
- téléphone strict
- commission numérique
- date homogène
- footer qui ne masque jamais le résumé
- wording “locations” au lieu de “contrats” si contexte métier
```

## 17.2 Nouveau bien

Étapes recommandées :

```txt
1. Bien
- nom
- type
- bailleur rattaché

2. Adresse
- adresse
- quartier
- ville
- description optionnelle

3. Validation
- résumé du bien
- bailleur
- adresse
- statut initial
```

À corriger / verrouiller :

```txt
- ville éditable ou automatique clairement distinguée
- icônes de select bien alignées
- badge “Bailleur rattaché” capable de wrap/truncate
- pas de champ inutile visible
```

## 17.3 Nouvelle unité locative

Étapes recommandées :

```txt
1. Unité
- bien parent
- type d’unité
- numéro / code

2. Loyer
- étage
- loyer mensuel
- statut
- description optionnelle

3. Validation
- unité
- bien parent
- loyer
- statut
```

À corriger / verrouiller :

```txt
- numéro/code alphanumérique
- loyer numérique strict
- sélection du bien en bottom sheet mobile
- chips capables de wrap proprement
```

## 17.4 Nouvelle location

Étapes recommandées :

```txt
1. Locataire
- choisir ou créer un locataire

2. Unité
- sélectionner une unité libre

3. Conditions
- date début
- date fin
- loyer
- caution
- commission
- destination

4. Validation
- locataire
- unité
- bailleur
- période
- loyer
- caution
- commission
- impact : unité occupée
```

À corriger / verrouiller :

```txt
- pas de stepper tronqué
- pas de “occupant” visible si l’UI parle de locataire
- listes de sélection sans limite invisible frustrante
- commission préremplie si bailleur sélectionné
- aucune mutation avant validation
```

## 17.5 Nouveau paiement

Étapes recommandées :

```txt
1. Contrat / échéance
- choisir la location ou le bail
- choisir l’échéance
- résumé compact

2. Paiement
- montant encaissé
- date
- mode
- référence transaction optionnelle

3. Validation
- résumé
- impact financier
- statut prévu
- document généré
```

Priorité mobile de validation :

```txt
montant payé
total après paiement
reliquat après paiement
commission
net bailleur
statut prévu
document généré
```

À corriger / verrouiller :

```txt
- montant strict et formaté
- résumé d’échéance compact
- étape 3 raccourcie
- pas de 8 ou 9 tuiles de même importance
- footer non intrusif
```

## 17.6 Nouvelle dépense

Étapes recommandées :

```txt
1. Nature
- catégorie
- montant
- date
- description

2. Affectation
- dépense agence
- dépense bailleur / bien
- bien concerné si applicable
- bénéficiaire

3. Justificatif & validation
- lien justificatif optionnel
- résumé financier
- impact
- validation finale
```

À corriger / verrouiller :

```txt
- montant strict
- cartes d’affectation plus compactes
- placeholder bénéficiaire court
- résumé final moins long
- texte justificatif court
```

## 17.7 Ajouter un document

Étapes recommandées :

```txt
1. Fichier
- dropzone
- fichier choisi
- type et taille

2. Classement
- nom document
- dossier métier
- conservation
- lien métier si nécessaire
- description courte

3. Confirmation
- résumé
- statut initial
- confidentialité
- ajout au coffre
```

À corriger / verrouiller :

```txt
- stepper document mobile comme référence
- nom fichier tronqué proprement
- “Élément lié” masqué si “Aucun élément”
- étape classement plus courte
- pas de scroll horizontal
```

---

# 18. Calculs et données métier

Certains wizards affichent des calculs avant validation. Ces calculs doivent être fiables et compréhensibles.

## 18.1 Taux de recouvrement

Formule cible :

```txt
Taux de recouvrement =
montant encaissé confirmé / montant attendu sur les échéances concernées
```

Règles :

```txt
- paiements annulés exclus
- partiels inclus à hauteur encaissée
- avances non rattachées à la période exclues par défaut
- si total attendu = 0, afficher —
- afficher la base du calcul si possible
```

Exemple :

```txt
72%
6 990 000 FCFA encaissés / 9 700 000 FCFA attendus
```

## 18.2 Prévisualisations

Les prévisualisations sont utiles, mais elles doivent être formulées clairement :

```txt
Le serveur recalculera les montants définitifs.
Cette prévisualisation guide la validation.
Les montants finaux proviennent du traitement financier sécurisé.
```

---

# 19. États disabled et erreurs

## 19.1 Bouton disabled

Un bouton disabled doit être visible mais discret.

Règles :

```txt
- pas trop sombre
- pas aussi dominant qu’un CTA actif
- texte lisible
- raison du blocage affichée si nécessaire
```

## 19.2 Erreurs

Les erreurs doivent être proches du champ concerné.

Exemples :

```txt
Montant obligatoire.
Téléphone invalide.
Commission entre 0 et 100.
Sélectionnez une échéance.
Ajoutez une date valide.
```

Pas d’erreur technique brute.

---

# 20. Accessibilité et confort tactile

Règles :

```txt
- boutons tactiles minimum 44px de hauteur
- champs confortables au clavier mobile
- focus visible
- Escape ferme sur desktop
- tap extérieur ferme uniquement si non destructif
- confirmation si abandon avec données saisies
```

Si l’utilisateur a commencé à remplir un wizard, fermer doit demander confirmation :

```txt
Quitter sans enregistrer ?
Les informations saisies seront perdues.
```

---

# 21. Composants à standardiser

Composants recommandés :

```txt
ProductWizard
WizardShell
WizardHeader
DesktopWizardStepper
MobileWizardStepper
WizardBody
WizardFooter
PremiumInput
MoneyInput
PercentInput
PhoneInput
DateField
PremiumTextarea
SmartCombobox
MobileSelectionSheet
ValidationSummaryCard
WizardNotice
WizardMetric
```

Règle :

```txt
Ne pas recréer un mini-système différent dans chaque page.
```

---

# 22. Definition of Done

Un wizard est validé seulement si :

```txt
Desktop :
- largeur adaptée
- pas d’espace vide ridicule
- stepper lisible
- footer propre
- pas de scroll horizontal
- champs alignés
- dropdowns non coupés
- résumé final clair

Mobile :
- testé iPhone 12 Pro
- tested iPhone 14 Pro Max
- bottom sheet propre
- header compact
- stepper non tronqué
- aucun contenu masqué par footer
- padding-bottom correct
- pas de scroll horizontal
- champs typés
- icônes non superposées
- dropdowns longs en bottom sheet
- validation finale compacte

Technique :
- typecheck OK
- lint OK
- tests unitaires impactés OK
- build OK
- aucune mutation métier directe
- aucun backend touché sans demande explicite
```

---

# 23. Ce qu’il ne faut surtout pas faire

Interdictions :

```txt
- compresser le desktop pour faire du mobile
- faire un wizard qui est juste une longue modale
- créer un style différent par page
- laisser les steppers tronquer les noms
- accepter n’importe quel caractère dans les champs métier
- utiliser des textes longs pour remplir l’espace
- laisser le footer masquer le contenu
- utiliser liquid glass partout
- afficher du jargon technique
- valider une action financière sans résumé clair
- modifier plusieurs workflows en même temps sans tests
```

---

# 24. Décision officielle

La norme officielle des wizards Samay Këur est :

```txt
Desktop :
modal premium centrée
stepper complet
grille lisible
résumé utile
footer propre

Mobile :
bottom sheet premium
header compact
stepper mobile spécifique
corps court et scroll maîtrisé
footer sticky sécurisé
inputs intelligents
dropdowns en bottom sheet
validation finale compacte
```

Phrase directrice :

```txt
Samay Këur ne remplit pas des formulaires.
Samay Këur guide des décisions métier contrôlées.
```

# APPENDICE — P0 OBSERVÉS DANS LES CAPTURES WIZARDS

Objectif :
Cette section verrouille les problèmes concrets observés dans les captures desktop et mobile. Elle évite qu’un agent applique la charte “en théorie” tout en oubliant les défauts visibles déjà identifiés.

Priorité absolue :
Ces points doivent être corrigés avant de considérer les wizards comme premium, cohérents et prêts à être généralisés.

1. Footer sticky qui masque le contenu

Problème observé :
Sur mobile, certains footers fixes couvrent une partie du contenu, notamment dans :
- Nouveau bailleur, étape validation ;
- Nouveau paiement, étape validation ;
- Nouvelle dépense, étape validation ;
- Ajouter document, étapes longues.

Règle officielle :
Le footer peut être sticky, mais il ne doit jamais cacher une carte, un champ, une ligne de résumé ou une information métier.

Critère d’acceptation :
Le contenu scrollable doit avoir un padding-bottom au moins égal à :

footer height + safe-area-bottom + 16px

Sur iPhone 12 Pro, on doit pouvoir lire toute la dernière carte avant le footer.

2. Stepper mobile tronqué

Problème observé :
Sur les wizards Paiement et Dépense, les libellés deviennent :
- “PAIEME...”
- “VALIDA...”
- “AFFECT...”

Cela donne une impression compressée et non premium.

Règle officielle :
Le mobile ne doit jamais réutiliser un stepper desktop compressé.

Norme mobile :
- format compact ;
- pas de texte tronqué ;
- affichage du type : “Étape 2 sur 3” + nom court ;
- barre de progression lisible ;
- libellé court : Contrat, Paiement, Validation, Nature, Affectation, Justificatif.

Le stepper mobile du wizard Documents est la meilleure référence actuelle.

3. Icônes qui chevauchent le texte

Problème observé :
Dans plusieurs selects et champs de recherche, l’icône loupe est trop proche du texte ou posée dessus.

Règle officielle :
Tout champ avec icône gauche doit réserver une zone fixe pour l’icône.

Norme :
- icône absolute left 14px ;
- padding-left minimum 40px ;
- texte jamais sous l’icône ;
- même règle pour input search, select, combobox, champ référence.

4. Champs métier trop permissifs

Problème observé :
Certains champs de montant, téléphone, commission, loyer ou date semblent accepter n’importe quelle saisie.

Règle officielle :
Les champs doivent être intelligents dès la saisie, pas seulement validés après coup.

Normes :
- montant, loyer, caution, dépense, paiement : chiffres uniquement ;
- téléphone : chiffres, espaces, “+” uniquement au début ;
- commission : nombre décimal, min 0, max métier défini ;
- date : champ date contrôlé, jamais texte libre ;
- numéro/code : alphanumérique autorisé ;
- nom/prénom : texte humain, mais refuser une valeur composée uniquement de chiffres.

5. Trop de scroll dans les wizards mobiles

Problème observé :
Certains wizards deviennent des mini-pages longues, alors qu’ils sont censés éviter cette logique.

Écrans concernés :
- Nouveau paiement, étape 3 ;
- Nouvelle dépense, étape 3 ;
- Ajouter document, étape 2 ;
- Nouveau paiement, étape 1 quand le résumé est trop détaillé.

Règle officielle :
Une étape mobile doit rester concentrée sur une action principale.

Correction attendue :
- réduire les textes ;
- masquer les champs non nécessaires ;
- afficher les détails secondaires en accordéon ;
- éviter les grilles trop longues ;
- limiter les cartes de validation à l’essentiel.

6. Nouveau paiement — corrections prioritaires

Problèmes observés :
- stepper mobile tronqué ;
- étape 1 trop longue une fois le contrat sélectionné ;
- étape 3 trop dense ;
- trop de mini-cartes d’impact financier ;
- footer sticky trop présent ;
- montant non formaté pendant la saisie.

Règle cible :
Étape 1 = choisir contrat + échéance + mini-résumé.
Étape 2 = montant + date + mode + feedback reliquat.
Étape 3 = validation compacte en 3 blocs maximum :
- récapitulatif ;
- impact financier ;
- résultat attendu.

Ne pas afficher 8 ou 9 tuiles de même importance sur mobile.

7. Nouvelle dépense — corrections prioritaires

Problèmes observés :
- stepper mobile tronqué ;
- étape 2 trop verbeuse ;
- étape 3 trop longue ;
- résumé financier trop vertical ;
- justificatif optionnel prend trop de place ;
- certains textes débordent ou cassent mal.

Règle cible :
Étape 1 = nature, montant, date, catégorie.
Étape 2 = affectation claire et compacte.
Étape 3 = résumé financier compact + justificatif + impact.

Les cartes “Dépense agence” / “Dépense bailleur/bien” doivent avoir :
- titre ;
- une seule ligne d’explication ;
- état sélectionné très clair.

8. Ajouter document — corrections prioritaires

Problèmes observés :
- étape 2 trop longue ;
- “Élément lié” visible même quand “Lier à” vaut “Aucun élément” ;
- nom du fichier tronqué brutalement ;
- “Confirmation” peut être tronqué dans le stepper mobile.

Règle cible :
- ne jamais afficher un champ conditionnel inutile ;
- “Élément lié” apparaît seulement si un type de lien est choisi ;
- fichier long : line-clamp ou truncate propre ;
- étape 2 doit rester courte et respirable.

9. Dropdowns et sheets de sélection mobile

Problème observé :
Le sheet de sélection du bien fonctionne, mais n’est pas encore une norme claire.

Règle officielle :
Sur mobile, les grandes listes de sélection doivent ouvrir un bottom sheet dédié.

Structure obligatoire :
- header compact ;
- titre clair ;
- bouton fermer ;
- champ recherche visible ;
- liste d’options ;
- option = nom principal + détail court ;
- pas de fausse option “Sélectionner un bien” cochée.

Exemple d’option correcte :
Nom du bien
Quartier · Ville
Badge éventuel : Libre / Occupé

10. Boutons sur deux lignes

Problème observé :
Certains boutons ou textes de CTA risquent de passer sur deux lignes.

Règle officielle :
Un bouton principal ne doit pas casser sur deux lignes.

Solutions :
- raccourcir le libellé ;
- augmenter la largeur ;
- réduire légèrement la taille texte ;
- utiliser une icône seulement si nécessaire.

Exemples :
“Enregistrer le paiement” est acceptable.
“Enregistrer définitivement le paiement sécurisé” ne l’est pas.

11. Desktop — footer flottant sur étapes longues

Problème observé :
Sur Nouveau paiement et Nouvelle dépense, certaines étapes longues utilisent un footer flottant qui peut donner une impression de contenu coupé.

Règle officielle :
Sur desktop, le footer peut rester visible, mais il doit appartenir clairement à la modal.

Il ne doit pas :
- masquer les cartes ;
- couper une section ;
- donner l’impression d’être posé au hasard sur le contenu.

Critère :
Si l’étape scrolle, le contenu doit prévoir un padding-bottom suffisant et le footer doit être visuellement séparé.

12. Desktop — dropdowns

Correction importante :
Un dropdown ouvert peut descendre bas si l’utilisateur l’a déployé volontairement. Ce n’est pas un bug en soi.

Règle officielle :
Le problème n’est pas qu’un dropdown descende ; le problème serait qu’il soit :
- coupé par la modal ;
- mal aligné ;
- sans max-height ;
- sans scroll interne ;
- derrière un autre élément.

Les dropdowns doivent donc avoir :
- z-index maîtrisé ;
- max-height ;
- scroll interne ;
- alignement propre ;
- aucun clipping.

13. Liquid glass maîtrisé

Décision officielle :
Le style liquid glass est pertinent, mais doit rester maîtrisé.

À utiliser sur :
- modal container ;
- bottom sheet ;
- overlay ;
- header de wizard ;
- stepper ;
- footer ;
- toasts ;
- surfaces de navigation.

À éviter sur :
- données financières critiques ;
- tableaux ;
- champs de saisie en excès ;
- cartes métier très denses.

Principe :
Le liquid glass sert le chrome UI, pas la donnée métier.

14. Taux de recouvrement à auditer

Point indépendant mais obligatoire :
La logique du taux de recouvrement doit être vérifiée.

Formule cible :
Taux de recouvrement = montant encaissé confirmé / montant attendu sur les échéances concernées.

À vérifier :
- exclure les paiements annulés ;
- inclure les paiements partiels à hauteur encaissée ;
- ne pas inclure les avances hors période sauf règle métier explicite ;
- si attendu = 0, afficher “—” au lieu de “0%” ;
- afficher la base du calcul, exemple :
  6 990 000 FCFA encaissés / 9 700 000 FCFA attendus.

15. Critères finaux d’acceptation mobile

Sur iPhone 12 Pro :
- aucun scroll horizontal ;
- aucun bouton ou champ masqué par le footer ;
- aucun texte important tronqué brutalement ;
- aucun stepper avec libellé coupé ;
- aucun champ avec icône posée sur le texte ;
- aucun CTA principal sur deux lignes ;
- chaque étape reste centrée sur une action ;
- les longues validations sont compressées intelligemment ;
- les dropdowns longs ouvrent un vrai bottom sheet.

16. Critères finaux d’acceptation desktop

Sur desktop :
- modal centrée ;
- largeur cohérente selon type de wizard ;
- header compact mais premium ;
- stepper complet lisible ;
- footer propre et stable ;
- aucun dropdown coupé ;
- aucune ligne de bouton sur deux lignes ;
- grilles équilibrées ;
- validation finale lisible sans surcharge ;
- scroll interne uniquement si nécessaire et jamais brutal.

Conclusion :
Un wizard Samay Këur ne doit pas être une page longue déguisée. Il doit guider l’utilisateur étape par étape, avec une forte impression de contrôle, de sécurité et de finition premium.


----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------



# Charte officielle — Routes, redirections et liens intelligents Samay Këur

## 0. Objectif

Les routes et redirections Samay Këur doivent permettre à l’utilisateur d’arriver directement au bon contexte métier.

Une redirection ne doit pas seulement envoyer vers une page.
Elle doit, si possible, ouvrir le bon filtre, le bon drawer, la bonne période, le bon onglet ou la bonne action.

Règle centrale :

```txt
Un clic doit mener au bon dossier, pas seulement à la bonne page.
```

Exemple mauvais :

```txt
Dashboard → Top impayé → /creances
```

Exemple correct :

```txt
Dashboard → Top impayé → /creances?drawer=creance:{id}&period=2026-06
```

---

# 1. Principes généraux

## 1.1 Une route doit porter le contexte

Une route Samay Këur doit pouvoir transporter :

* la page ;
* le filtre ;
* la période ;
* l’entité sélectionnée ;
* le drawer ouvert ;
* l’action en cours ;
* l’onglet actif ;
* la source du clic.

Exemple :

```txt
/creances?period=2026-06&status=late&drawer=creance:abc123&source=dashboard
```

---

## 1.2 L’URL doit être partageable en interne

Si un utilisateur copie l’URL d’un dossier interne, l’app doit pouvoir restaurer :

* la page ;
* le filtre ;
* le drawer ;
* l’onglet ;
* l’élément sélectionné.

Exemple :

```txt
/bailleurs?drawer=bailleur:abc123&tab=rapports
```

Le refresh navigateur ne doit pas faire perdre le contexte.

---

## 1.3 Fermer un drawer doit nettoyer l’URL

Si l’utilisateur ferme le drawer :

```txt
/bailleurs?drawer=bailleur:abc123
```

devient :

```txt
/bailleurs
```

ou garde seulement les filtres utiles :

```txt
/bailleurs?status=active
```

Le bouton retour navigateur doit pouvoir fermer le drawer avant de quitter la page.

---

# 2. Nomenclature officielle des routes

Routes métier principales :

```txt
/dashboard
/bailleurs
/patrimoine
/locations
/encaissements
/creances
/depenses
/documents
/documents/scanner
/proprietaires/:bailleurId
/rapports
/parametres
```

Routes publiques :

```txt
/verify?token={token}
```

Routes anciennes à ne plus utiliser :

```txt
/loyers-impayes
/rapport-financier
/reports-old
```

Ces anciennes routes doivent rediriger vers les routes canoniques.

Exemples :

```txt
/loyers-impayes → /creances
/rapport-financier → /encaissements?view=performance
```

Aucune page cachée obsolète ne doit rester accessible via un bouton ou une action.

---

# 3. Paramètres standards

## 3.1 Filtres communs

```txt
q=texte
period=YYYY-MM
status=active|late|partial|paid|archived
bailleurId=uuid
bienId=uuid
uniteId=uuid
locationId=uuid
locataireId=uuid
documentId=uuid
type=quittance|contrat|mandat|rapport|libre
source=dashboard|drawer|documents|owner-space
```

## 3.2 Drawer

Format officiel :

```txt
drawer={type}:{id}
```

Exemples :

```txt
drawer=bailleur:abc123
drawer=bien:abc123
drawer=unite:abc123
drawer=location:abc123
drawer=paiement:abc123
drawer=creance:abc123
drawer=depense:abc123
drawer=document:abc123
drawer=rapport:abc123
```

## 3.3 Onglets

Format :

```txt
tab=overview|finances|documents|rapports|historique|biens|locations|paiements
```

Exemple :

```txt
/proprietaires/abc123?tab=finances&period=2026-06
```

## 3.4 Actions

Format :

```txt
action=create|edit|pay|archive|generate-report|upload-document
```

Exemple :

```txt
/encaissements?action=create&creanceId=abc123
```

---

# 4. Règle Dashboard

Le Dashboard est un cockpit. Chaque clic doit mener à une vue précise.

## 4.1 KPI Dashboard

| Élément cliqué      | Route cible                                      |
| ------------------- | ------------------------------------------------ |
| Encaissements       | `/encaissements?period=current`                  |
| Reliquats / retards | `/creances?status=late&period=current`           |
| Net bailleurs       | `/bailleurs?filter=net-to-pay`                   |
| Commissions         | `/encaissements?view=commissions&period=current` |
| Occupation          | `/patrimoine?view=occupation`                    |
| Documents / preuves | `/documents?status=active`                       |

## 4.2 Top impayés

Mauvais :

```txt
/creances
```

Correct :

```txt
/creances?drawer=creance:{creanceId}&period={period}&source=dashboard
```

Si l’ID exact n’est pas disponible :

```txt
/creances?q={locataireName}&status=late&period={period}
```

Mais la priorité doit être d’ouvrir le drawer exact.

## 4.3 Activité récente

Chaque activité doit ouvrir l’élément concerné.

| Activité        | Route cible                           |
| --------------- | ------------------------------------- |
| Paiement reçu   | `/encaissements?drawer=paiement:{id}` |
| Dépense créée   | `/depenses?drawer=depense:{id}`       |
| Document généré | `/documents?drawer=document:{id}`     |
| Location créée  | `/locations?drawer=location:{id}`     |
| Bailleur ajouté | `/bailleurs?drawer=bailleur:{id}`     |
| Bien ajouté     | `/patrimoine?drawer=bien:{id}`        |

## 4.4 Voir détail financier

Le bouton Dashboard “Voir le détail financier” ne doit jamais pointer vers l’ancienne page `rapport-financier`.

Route cible officielle :

```txt
/encaissements?view=performance&period=current
```

ou, si une vraie page Finance existe :

```txt
/finance?tab=performance&period=current
```

L’ancienne route doit rediriger vers la nouvelle.

---

# 5. Routes Bailleurs

## 5.1 Liste bailleurs

```txt
/bailleurs
/bailleurs?q=modou
/bailleurs?status=active
/bailleurs?drawer=bailleur:{id}
```

## 5.2 Drawer bailleur

Depuis le drawer Bailleur :

| Action                     | Route cible                                        |
| -------------------------- | -------------------------------------------------- |
| Voir biens                 | `/patrimoine?bailleurId={id}`                      |
| Voir locations             | `/locations?bailleurId={id}`                       |
| Voir encaissements         | `/encaissements?bailleurId={id}`                   |
| Voir créances              | `/creances?bailleurId={id}&status=late`            |
| Voir documents             | `/documents?entity=bailleur&entityId={id}`         |
| Générer rapport            | `/rapports?action=generate-report&bailleurId={id}` |
| Ouvrir espace propriétaire | `/proprietaires/{id}`                              |

## 5.3 Redirection vers Espace propriétaire

Le bouton “Espace propriétaire” doit être explicite.

```txt
/bailleurs?drawer=bailleur:{id}
↓
/proprietaires/{id}
```

L’Espace propriétaire ne remplace pas la fiche bailleur.
Il sert à consulter le portefeuille du propriétaire dans une vue dédiée.

---

# 6. Espace propriétaire

## 6.1 Rôle

L’Espace propriétaire est une vue centrée sur un bailleur/propriétaire.

Il doit regrouper :

* synthèse ;
* patrimoine ;
* locations ;
* finances ;
* dépenses imputées ;
* rapports ;
* documents ;
* historique.

Route officielle :

```txt
/proprietaires/:bailleurId
```

## 6.2 Onglets officiels

```txt
/proprietaires/{id}?tab=overview
/proprietaires/{id}?tab=patrimoine
/proprietaires/{id}?tab=locations
/proprietaires/{id}?tab=finances
/proprietaires/{id}?tab=depenses
/proprietaires/{id}?tab=rapports
/proprietaires/{id}?tab=documents
```

## 6.3 Deep links dans l’Espace propriétaire

| Élément          | Route                                                            |
| ---------------- | ---------------------------------------------------------------- |
| Rapport bailleur | `/proprietaires/{id}?tab=rapports&drawer=rapport:{rapportId}`    |
| Document         | `/proprietaires/{id}?tab=documents&drawer=document:{documentId}` |
| Bien             | `/proprietaires/{id}?tab=patrimoine&drawer=bien:{bienId}`        |
| Location         | `/proprietaires/{id}?tab=locations&drawer=location:{locationId}` |
| Paiement         | `/proprietaires/{id}?tab=finances&drawer=paiement:{paiementId}`  |
| Dépense imputée  | `/proprietaires/{id}?tab=depenses&drawer=depense:{depenseId}`    |

## 6.4 Redirection depuis autres pages vers Espace propriétaire

Depuis un drawer document, paiement, dépense, bien ou location lié à un bailleur :

```txt
Voir propriétaire
→ /proprietaires/{bailleurId}
```

Depuis une ligne bailleur :

```txt
Ouvrir espace propriétaire
→ /proprietaires/{bailleurId}?tab=overview
```

## 6.5 Important

L’Espace propriétaire interne n’est pas automatiquement un portail public.

Si un portail propriétaire externe existe plus tard, il doit avoir une route et une sécurité séparées.

Exemple futur :

```txt
/owner-portal/{secureToken}
```

Ne pas exposer les routes internes `/proprietaires/:id` publiquement.

---

# 7. Routes Patrimoine

## 7.1 Liste patrimoine

```txt
/patrimoine
/patrimoine?view=biens
/patrimoine?view=unites
/patrimoine?bailleurId={id}
```

## 7.2 Drawers

```txt
/patrimoine?drawer=bien:{id}
/patrimoine?drawer=unite:{id}
```

## 7.3 Actions depuis drawer Bien / Unité

| Action                   | Route cible                                      |
| ------------------------ | ------------------------------------------------ |
| Voir bailleur            | `/bailleurs?drawer=bailleur:{bailleurId}`        |
| Voir espace propriétaire | `/proprietaires/{bailleurId}?tab=patrimoine`     |
| Voir locations du bien   | `/locations?bienId={bienId}`                     |
| Voir encaissements       | `/encaissements?bienId={bienId}`                 |
| Voir créances            | `/creances?bienId={bienId}`                      |
| Voir documents           | `/documents?entity=bien&entityId={bienId}`       |
| Ajouter unité            | `/patrimoine?action=create-unit&bienId={bienId}` |

---

# 8. Routes Locations

## 8.1 Liste locations

```txt
/locations
/locations?status=active
/locations?bailleurId={id}
/locations?bienId={id}
/locations?drawer=location:{id}
```

## 8.2 Drawer location

Actions :

| Action              | Route cible                                                       |
| ------------------- | ----------------------------------------------------------------- |
| Voir bailleur       | `/bailleurs?drawer=bailleur:{bailleurId}`                         |
| Espace propriétaire | `/proprietaires/{bailleurId}?tab=locations`                       |
| Voir bien / unité   | `/patrimoine?drawer=unite:{uniteId}`                              |
| Voir paiements      | `/encaissements?locationId={locationId}`                          |
| Voir créances       | `/creances?locationId={locationId}`                               |
| Voir documents      | `/documents?entity=location&entityId={locationId}`                |
| Encaisser           | `/encaissements?action=create&locationId={locationId}`            |
| Générer contrat     | `/documents?action=generate&type=contrat&locationId={locationId}` |

---

# 9. Routes Encaissements

## 9.1 Liste encaissements

```txt
/encaissements
/encaissements?period=2026-06
/encaissements?bailleurId={id}
/encaissements?locationId={id}
/encaissements?drawer=paiement:{id}
```

## 9.2 Actions

| Action                   | Route cible                                    |
| ------------------------ | ---------------------------------------------- |
| Nouveau paiement         | `/encaissements?action=create`                 |
| Paiement depuis créance  | `/encaissements?action=create&creanceId={id}`  |
| Paiement depuis location | `/encaissements?action=create&locationId={id}` |
| Voir quittance           | `/documents?drawer=document:{documentId}`      |
| Voir bailleur            | `/bailleurs?drawer=bailleur:{bailleurId}`      |
| Voir espace propriétaire | `/proprietaires/{bailleurId}?tab=finances`     |

Le wizard paiement doit être prérempli si `creanceId`, `locationId` ou `echeanceId` est présent.

---

# 10. Routes Créances à recouvrer

## 10.1 Liste créances

```txt
/creances
/creances?status=late
/creances?period=2026-06
/creances?bailleurId={id}
/creances?drawer=creance:{id}
```

## 10.2 Actions depuis une créance

| Action              | Route cible                                   |
| ------------------- | --------------------------------------------- |
| Encaisser           | `/encaissements?action=create&creanceId={id}` |
| Voir location       | `/locations?drawer=location:{locationId}`     |
| Voir bailleur       | `/bailleurs?drawer=bailleur:{bailleurId}`     |
| Espace propriétaire | `/proprietaires/{bailleurId}?tab=finances`    |
| Voir documents      | `/documents?entity=creance&entityId={id}`     |

Le clic sur un nom dans “Top impayés” ou “Créances” doit ouvrir la créance exacte si possible.

---

# 11. Routes Dépenses

## 11.1 Liste dépenses

```txt
/depenses
/depenses?period=2026-06
/depenses?scope=agence
/depenses?scope=bailleur
/depenses?bailleurId={id}
/depenses?drawer=depense:{id}
```

## 11.2 Actions

| Action                | Route cible                                |
| --------------------- | ------------------------------------------ |
| Nouvelle dépense      | `/depenses?action=create`                  |
| Dépense pour bailleur | `/depenses?action=create&bailleurId={id}`  |
| Dépense pour bien     | `/depenses?action=create&bienId={id}`      |
| Voir bailleur         | `/bailleurs?drawer=bailleur:{bailleurId}`  |
| Espace propriétaire   | `/proprietaires/{bailleurId}?tab=depenses` |
| Voir bien             | `/patrimoine?drawer=bien:{bienId}`         |
| Voir justificatif     | `/documents?drawer=document:{documentId}`  |

---

# 12. Routes Documents

## 12.1 Liste documents

```txt
/documents
/documents?type=quittance
/documents?type=rapport
/documents?entity=bailleur&entityId={id}
/documents?drawer=document:{id}
```

## 12.2 Actions depuis document

| Document lié à   | Route “Voir source”                                                   |
| ---------------- | --------------------------------------------------------------------- |
| Bailleur         | `/bailleurs?drawer=bailleur:{bailleurId}`                             |
| Bien             | `/patrimoine?drawer=bien:{bienId}`                                    |
| Unité            | `/patrimoine?drawer=unite:{uniteId}`                                  |
| Location         | `/locations?drawer=location:{locationId}`                             |
| Paiement         | `/encaissements?drawer=paiement:{paiementId}`                         |
| Créance          | `/creances?drawer=creance:{creanceId}`                                |
| Dépense          | `/depenses?drawer=depense:{depenseId}`                                |
| Rapport bailleur | `/proprietaires/{bailleurId}?tab=rapports&drawer=rapport:{rapportId}` |

## 12.3 Scanner

Route interne :

```txt
/documents/scanner
```

Résultat interne reconnu :

```txt
/documents?drawer=document:{documentId}&source=scanner
```

Route publique QR :

```txt
/verify?token={token}
```

La route publique ne doit jamais exposer un document privé.
Elle vérifie uniquement l’authenticité.

---

# 13. Routes Rapports

## 13.1 Rapports généraux

```txt
/rapports
/rapports?type=bailleur
/rapports?period=2026-06
```

## 13.2 Rapport bailleur

```txt
/rapports?action=generate-report&bailleurId={id}
```

Après génération :

```txt
/documents?drawer=document:{documentId}
```

ou depuis l’Espace propriétaire :

```txt
/proprietaires/{bailleurId}?tab=rapports&drawer=rapport:{rapportId}
```

Un rapport généré doit toujours finir dans Documents / Coffre documentaire.

---

# 14. Comportement des drawers

## 14.1 Clic sur ligne

Sur desktop :

```txt
clic ligne → ouvre drawer + met à jour URL
```

Sur mobile :

```txt
tap carte → ouvre drawer plein écran + met à jour URL
```

## 14.2 Fermeture

Fermer le drawer :

```txt
retire drawer de l’URL
conserve les filtres
conserve la période
conserve la recherche si utile
```

## 14.3 Élément introuvable

Si l’URL demande un drawer mais que l’élément n’existe plus :

```txt
- rester sur la page
- retirer drawer de l’URL
- afficher un toast clair
```

Message :

```txt
Élément introuvable ou inaccessible.
```

Ne jamais afficher une page vide cassée.

---

# 15. Redirections intelligentes

## 15.1 Règle

Un lien interne doit choisir le niveau de précision maximal disponible.

Ordre de priorité :

```txt
1. page + drawer exact
2. page + filtre exact
3. page + recherche préremplie
4. page simple
```

Exemple :

Si `creanceId` existe :

```txt
/creances?drawer=creance:{id}
```

Sinon si seulement le locataire existe :

```txt
/creances?q={locataireName}&status=late
```

---

# 16. Retour après action

Quand un wizard est ouvert depuis un contexte, il doit pouvoir revenir au contexte initial.

Utiliser :

```txt
returnTo={encodedUrl}
```

Exemple :

```txt
/encaissements?action=create&creanceId=abc123&returnTo=/creances?drawer=creance:abc123
```

Après succès :

```txt
retourner au returnTo
ou ouvrir le drawer de l’élément créé
```

Exemple :

```txt
paiement créé → /encaissements?drawer=paiement:{newPaiementId}
```

ou :

```txt
paiement depuis créance → /creances?drawer=creance:{creanceId}
```

selon le besoin métier.

---

# 17. Sécurité et permissions

Les routes internes ne donnent jamais accès par elles-mêmes aux données.

Règles :

```txt
- toujours vérifier l’agence active
- toujours vérifier les permissions
- ne jamais faire confiance à un id dans l’URL
- ne jamais exposer un document privé via route publique
- si accès refusé, afficher message clair
```

Message :

```txt
Vous n’avez pas accès à cet élément.
```

Si utilisateur non connecté :

```txt
/login?returnTo={encodedUrl}
```

Après connexion, l’app doit restaurer la route demandée si l’accès est autorisé.

---

# 18. Règles mobile

Sur mobile :

* un lien vers un élément doit ouvrir le drawer plein écran ;
* pas seulement filtrer la page ;
* le retour navigateur doit fermer le drawer ;
* les cartes mobiles ne doivent pas contenir trop de liens internes ;
* les actions sensibles vivent dans le drawer.

Exemple :

```txt
tap carte créance → drawer créance
dans drawer → bouton Encaisser
```

Pas :

```txt
tap sur téléphone dans la carte → appel accidentel
```

---

# 19. Anciennes routes et dette de nommage

Toutes les anciennes routes doivent être auditées.

P0 à corriger :

```txt
/loyers-impayes
/rapport-financier
```

Règles :

```txt
- garder alias temporaire si nécessaire
- rediriger vers route canonique
- ne plus utiliser dans boutons ou liens
- supprimer les imports UI obsolètes si possible
```

Exemples :

```txt
/loyers-impayes → /creances
/rapport-financier → /encaissements?view=performance
```

---

# 20. Definition of Done

Une redirection est validée si :

```txt
- elle mène à la bonne page ;
- elle applique le bon filtre ;
- elle ouvre le bon drawer si un id existe ;
- elle garde la période si nécessaire ;
- elle ne pointe pas vers une page cachée ;
- elle restaure le contexte après refresh ;
- elle respecte le bouton retour ;
- elle fonctionne desktop et mobile ;
- elle respecte les permissions ;
- elle affiche un état propre si l’élément n’existe plus.
```

Phrase finale :

```txt
Samay Këur ne doit pas seulement naviguer.
Samay Këur doit amener l’utilisateur directement au bon dossier métier.
```

