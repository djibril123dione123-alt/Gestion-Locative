# Guide - Paramètres Agence et Personnalisation des Documents

## Vue d'ensemble

Le système de gestion immobilière dispose maintenant d'une page **Paramètres** complète permettant à chaque agence de personnaliser entièrement ses documents (contrats de location, mandats de gérance, factures).

## Accès à la page Paramètres

Un nouveau bouton **"Paramètres"** est désormais visible dans le menu latéral (sidebar), accessible uniquement aux utilisateurs ayant le rôle **admin**.

## Fonctionnalités implémentées

### 1. Base de données

**Migration ajoutée** : `add_agency_settings_document_fields.sql`

Nouveaux champs dans la table `agency_settings` :
- `rc` : Registre de commerce
- `site_web` : Site web de l'agence
- `representant_nom` : Nom du représentant légal
- `representant_fonction` : Fonction (Gérant, Directeur, etc.)
- `manager_id_type` : Type de pièce d'identité (CNI, Passeport, etc.)
- `manager_id_number` : Numéro de la pièce d'identité du représentant
- `city` : Ville de l'agence (défaut: Dakar)
- `mention_tribunal` : Tribunal compétent (défaut: Tribunal de commerce de Dakar)
- `mention_penalites` : Texte standard des pénalités de retard
- `couleur_secondaire` : Couleur secondaire pour les documents
- `logo_position` : Position du logo (left, center, right)
- `frais_huissier` : Montant des frais d'huissier (défaut: 37500 FCFA)

**Bucket storage** : `agency-assets`
- Stockage sécurisé des logos d'agence
- Taille max : 2 Mo
- Formats acceptés : PNG, JPG, JPEG, GIF, WEBP
- Accès public en lecture (pour affichage dans les documents)
- Politiques RLS pour upload/update/delete par agence

### 2. Interface utilisateur

**Page Paramètres** (`src/pages/Parametres.tsx`)

Trois onglets principaux :

#### a) Informations générales
- Nom de l'agence
- Téléphone, Email, Site web
- Adresse complète
- NINEA (Numéro d'Identification National des Entreprises et Associations)
- RC (Registre de Commerce)
- Nom et fonction du représentant légal
- Type et numéro de pièce d'identité du représentant
- Ville de l'agence

#### b) Modèles de documents
- Tribunal compétent (utilisé dans contrats et mandats)
- Texte des pénalités de retard (article 8 des contrats)
- Pied de page personnalisé (affiché sur tous les documents)
- Frais d'huissier (FCFA)
- Pénalité par jour de retard (FCFA)
- Délai avant application des pénalités (jours)

#### c) Apparence
- **Upload de logo** : Interface drag & drop avec aperçu
- **Position du logo** : Gauche / Centre / Droite
- **Couleur primaire** : Couleur principale de la marque (en-têtes)
- **Couleur secondaire** : Couleur secondaire (textes, bordures)
- Sélecteur de couleur visuel + code hexadécimal

### 3. Templates de documents

**Nouveaux fichiers créés** :

#### `src/lib/templates/contrat.ts`
- Interface `ContratData` : Structure complète des données nécessaires
- Fonction `generateContratText()` : Génère le texte du contrat avec toutes les variables

**Variables disponibles** :
```typescript
{{agence_nom}}
{{agence_adresse}}
{{agence_telephone}}
{{agence_email}}
{{agence_site_web}}
{{agence_ninea}}
{{agence_rc}}
{{agence_representant_nom}}
{{agence_representant_fonction}}
{{agence_manager_id_type}}
{{agence_manager_id_number}}
{{agence_city}}
{{agence_mention_tribunal}}
{{agence_mention_penalites}}
{{agence_frais_huissier}}

{{bailleur_prenom}}
{{bailleur_nom}}
{{bailleur_cni}}
{{bailleur_adresse}}

{{locataire_prenom}}
{{locataire_nom}}
{{locataire_cni}}
{{locataire_adresse}}

{{bien_designation}}
{{bien_adresse}}
{{bien_destination}}

{{contrat_duree_annees}}
{{contrat_date_debut}}
{{contrat_date_fin}}
{{contrat_loyer_mensuel}}
{{contrat_loyer_lettres}}
{{contrat_depot_garantie}}
{{contrat_depot_lettres}}
{{contrat_date_du_jour}}
```

#### `src/lib/templates/mandat.ts`
- Interface `MandatData` : Structure des données pour mandat de gérance
- Fonction `generateMandatText()` : Génère le texte du mandat

**Variables disponibles** :
```typescript
{{agence_*}} (mêmes que contrat, incluant city, manager_id_type, manager_id_number)
{{bailleur_*}} (mêmes que contrat)
{{bien_composition}} (ex: "2 chambres salon, cuisine, douche")
{{mandat_date_debut}}
{{mandat_taux_honoraires}} (pourcentage)
{{mandat_date_du_jour}}
```

**Améliorations apportées** :
- ✅ Plus de valeurs en dur (PAPA MOUHAMADOU FALL, CNI fixe, etc.)
- ✅ Ville paramétrable (Dakar, Thiès, Saint-Louis, etc.)
- ✅ Pièce d'identité du représentant flexible (CNI, Passeport, Carte consulaire)
- ✅ Signature avec nom de l'agence

#### `src/lib/templates/helpers.ts`
Fonctions utilitaires :
- `getAgencySettings(agencyId)` : Charge les paramètres de l'agence depuis Supabase
- `numberToFrenchWords(num)` : Convertit un nombre en lettres françaises
- `formatCurrency(amount, devise)` : Formate un montant avec la devise
- `formatDate(date)` : Formate une date (JJ/MM/AAAA)
- `formatDateLong(date)` : Formate une date (1 janvier 2024)

### 4. Navigation

**Mise à jour** : `src/components/layout/Sidebar.tsx`
- Import de l'icône `Settings` depuis lucide-react
- Ajout de l'élément de menu "Paramètres" (visible pour role='admin')

**Mise à jour** : `src/App.tsx`
- Import lazy du composant `Parametres`
- Ajout de la route `case 'parametres'` dans le switch

## Utilisation

### Pour l'administrateur

1. **Accéder aux paramètres**
   - Cliquer sur "Paramètres" dans le menu latéral

2. **Remplir les informations générales**
   - Compléter tous les champs obligatoires (nom, adresse, téléphone, email)
   - Ajouter NINEA et RC si disponibles
   - Indiquer le nom et la fonction du représentant

3. **Personnaliser les documents**
   - Adapter le texte des pénalités si nécessaire
   - Modifier le tribunal compétent si l'agence n'est pas à Dakar
   - Personnaliser le pied de page

4. **Configurer l'apparence**
   - Uploader le logo de l'agence (recommandé : PNG avec fond transparent)
   - Choisir la position du logo
   - Sélectionner les couleurs de la marque

5. **Enregistrer**
   - Cliquer sur "Enregistrer" en haut à droite
   - Les modifications sont appliquées immédiatement

### Pour les développeurs

#### Intégrer les templates dans la génération de PDF

```typescript
import { generateContratText, ContratData } from '../lib/templates/contrat';
import { getAgencySettings } from '../lib/templates/helpers';

// Charger les paramètres de l'agence
const agencySettings = await getAgencySettings(agencyId);

// Préparer les données
const contratData: ContratData = {
  agence: {
    nom: agencySettings.nom_agence,
    adresse: agencySettings.adresse,
    telephone: agencySettings.telephone,
    email: agencySettings.email,
    site_web: agencySettings.site_web,
    ninea: agencySettings.ninea,
    rc: agencySettings.rc,
    representant_nom: agencySettings.representant_nom,
    representant_fonction: agencySettings.representant_fonction,
    logo_url: agencySettings.logo_url,
    couleur_primaire: agencySettings.couleur_primaire,
    couleur_secondaire: agencySettings.couleur_secondaire,
    mention_tribunal: agencySettings.mention_tribunal,
    mention_penalites: agencySettings.mention_penalites,
    pied_page: agencySettings.pied_page_personnalise,
    frais_huissier: agencySettings.frais_huissier,
  },
  bailleur: {
    prenom: bailleur.prenom,
    nom: bailleur.nom,
    cni: bailleur.piece_identite,
    adresse: bailleur.adresse,
  },
  locataire: {
    prenom: locataire.prenom,
    nom: locataire.nom,
    cni: locataire.piece_identite,
    adresse: locataire.adresse_personnelle,
  },
  bien: {
    adresse: unite.immeuble.adresse,
    designation: unite.nom,
    destination: contrat.destination,
  },
  contrat: {
    duree_annees: 1,
    date_debut: formatDate(contrat.date_debut),
    date_fin: contrat.date_fin ? formatDate(contrat.date_fin) : undefined,
    loyer_mensuel: contrat.loyer_mensuel,
    loyer_lettres: numberToFrenchWords(contrat.loyer_mensuel) + ' francs CFA',
    depot_garantie: contrat.caution,
    depot_lettres: numberToFrenchWords(contrat.caution) + ' francs CFA',
    date_du_jour: formatDateLong(new Date()),
  },
};

// Générer le texte
const contratText = generateContratText(contratData);

// Ajouter au PDF avec jsPDF
// ... logique d'ajout au document PDF
```

#### Ajouter le logo au PDF

```typescript
import jsPDF from 'jspdf';

async function addLogoToPDF(doc: jsPDF, logoUrl: string, position: 'left' | 'center' | 'right') {
  if (!logoUrl) return 10; // Y position de départ si pas de logo

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = logoUrl;
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const imgWidth = 30;
    const imgHeight = (img.height / img.width) * imgWidth;

    let xPos = 14; // left par défaut
    if (position === 'center') {
      xPos = (pageWidth - imgWidth) / 2;
    } else if (position === 'right') {
      xPos = pageWidth - imgWidth - 14;
    }

    doc.addImage(img, 'PNG', xPos, 10, imgWidth, imgHeight);

    return 10 + imgHeight + 5; // Retourne la position Y après le logo
  } catch (error) {
    console.error('Erreur chargement logo:', error);
    return 10;
  }
}
```

## Architecture des fichiers

```
src/
├── pages/
│   └── Parametres.tsx          # Page principale des paramètres
├── lib/
│   ├── templates/
│   │   ├── contrat.ts          # Template contrat de location
│   │   ├── mandat.ts           # Template mandat de gérance
│   │   └── helpers.ts          # Fonctions utilitaires
│   ├── pdf.ts                  # Génération PDF (à adapter)
│   └── supabase.ts
└── components/
    └── layout/
        └── Sidebar.tsx         # Menu avec bouton Paramètres

supabase/
└── migrations/
    └── add_agency_settings_document_fields.sql

public/
└── templates/
    ├── contrat_location.txt    # Ancien template (référence)
    └── mandat_gerance.txt      # Ancien template (référence)
```

## Points d'attention

### Sécurité
- RLS activé sur `agency_settings` : chaque agence ne peut voir/modifier que ses propres paramètres
- Upload de logos : limité aux utilisateurs authentifiés de l'agence concernée
- Validation des types MIME pour les images

### Performance
- Les paramètres sont chargés une seule fois par génération de document
- Les logos sont mis en cache par le navigateur (URL publiques)
- Lazy loading de la page Paramètres

### Maintenance
- Valeurs par défaut définies pour tous les champs
- Fallback sur les données de la table `agencies` si `agency_settings` n'existe pas encore
- Messages d'erreur clairs en cas de problème

## Prochaines étapes (optionnel)

1. **Adapter la génération des contrats existants**
   - Modifier `src/pages/Contrats.tsx` pour utiliser `generateContratText()`
   - Remplacer les templates hardcodés par les variables

2. **Implémenter la génération des mandats**
   - Créer une page dédiée pour les mandats de gérance
   - Utiliser `generateMandatText()`

3. **Personnaliser les factures/quittances**
   - Créer un template pour les factures
   - Ajouter le logo et les couleurs de l'agence

4. **Prévisualisation en temps réel**
   - Ajouter un onglet "Aperçu" dans les paramètres
   - Montrer comment les documents vont apparaître

5. **Templates multiples**
   - Permettre de créer plusieurs versions de contrats
   - Laisser l'utilisateur choisir le template lors de la génération

## Support

Pour toute question ou problème :
1. Vérifier les logs de la console du navigateur
2. Vérifier les logs Supabase (erreurs de requêtes)
3. S'assurer que l'utilisateur a le rôle 'admin'
4. Vérifier que `agency_id` est bien défini dans le profil utilisateur
