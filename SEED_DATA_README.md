# Script de Génération de Données de Test

Ce script génère des données de test réalistes pour Confort Immo Archi, adaptées au marché sénégalais et africain francophone.

## Vue d'ensemble

Le script crée **3 agences** avec différents volumes de données :

### 1. Immobilier Dakar Premium (Petite agence)
- 2 bailleurs
- 3 immeubles
- ~30 unités
- 6 locataires
- 8 contrats actifs
- 3 mois d'historique de paiements
- 5 dépenses

**Utilité** : Tester les fonctionnalités de base, écrans avec peu de données, cas simples.

### 2. Sénégal Gestion Locative (Agence moyenne)
- 5 bailleurs
- 8 immeubles
- ~70 unités
- 20 locataires
- 25 contrats actifs
- 9 mois d'historique de paiements
- 15 dépenses

**Utilité** : Cas d'usage réalistes, test des filtres, rapports avec volume moyen.

### 3. Teranga Immobilier Group (Grande agence)
- 12 bailleurs
- 20 immeubles
- ~180 unités
- 60 locataires
- 70 contrats actifs
- 12 mois d'historique de paiements
- 30 dépenses

**Utilité** : Test de performance, pagination, cas limites, rapports complexes.

## Données Réalistes

### Noms et Prénoms Sénégalais
Le script utilise des noms authentiques : Diop, Sall, Ndiaye, Faye, Sarr, Ba, Sy, Fall, etc.
Prénoms : Moussa, Amadou, Fatou, Awa, Mamadou, Aissatou, Ibrahima, Mariama, etc.

### Localisation
- **Villes** : Dakar, Pikine, Rufisque, Thiès, Saint-Louis
- **Quartiers** : Plateau, Almadies, Mermoz, Sacré-Cœur, Point E, Fann, Ouakam, Yoff, Ngor, Pikine, Guédiawaye, etc.

### Loyers en XOF (Franc CFA)
- Studio : 75 000 - 150 000 XOF
- Appartement : 150 000 - 500 000 XOF
- Bureau : 200 000 - 800 000 XOF
- Commerce : 250 000 - 1 000 000 XOF

### Modes de Paiement
- Espèces
- Virement bancaire
- Mobile Money (Wave, Orange Money, Free Money)
- Chèque

### Données Générées
- Numéros de téléphone au format sénégalais : +221 77 XXX XX XX
- Emails avec domaines locaux (.sn) et internationaux
- NINEA (Numéro d'Identification National des Entreprises et Associations)
- CNI (Carte Nationale d'Identité) pour les locataires et bailleurs

## Cas Métier Couverts

### Paiements
- ✅ **85% de paiements à l'heure** (payés entre le 1er et le 15 du mois)
- ⚠️ **15% d'impayés** pour tester les relances et rapports d'impayés
- 💰 **Calcul automatique** des commissions agence (8%, 10%, 12%, ou 15%)
- 📊 **Historique** sur 3, 9 ou 12 mois selon l'agence

### Contrats
- 🟢 **90% de contrats actifs**
- 🔴 **10% de contrats expirés** pour tester les fins de contrat
- 📝 Destinations variées : Habitation, Commercial, Mixte

### Unités
- 🏠 Types variés : Studio, Appartement, Bureau, Commerce
- ✅ **Statuts** : Libre (unités sans contrat), Loué (avec contrat actif)
- 📐 Superficies réalistes : 25-40 m² (studio), 50-150 m² (appartement)

### Dépenses
- 🔧 Catégories : Entretien, Réparation, Électricité, Eau, Gardiennage, Assurance, Taxe foncière, Peinture, Plomberie, Nettoyage
- 💸 Montants : 10 000 - 500 000 XOF
- 📅 Réparties sur l'année 2024

## Installation

### Prérequis
```bash
npm install
```

Cela installera automatiquement la dépendance `dotenv` nécessaire au script.

### Variables d'Environnement

Le script nécessite les variables suivantes dans votre fichier `.env` :

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-anon-key

# OPTIONNEL mais RECOMMANDÉ pour bypasser les RLS
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key
```

**Important** :
- Si `SUPABASE_SERVICE_ROLE_KEY` est fourni, le script bypass les politiques RLS (recommandé pour le seed)
- Sinon, il utilise `VITE_SUPABASE_ANON_KEY` mais peut rencontrer des erreurs RLS

## Utilisation

### Générer toutes les données
```bash
npm run seed
```

Cette commande va :
1. Créer 3 agences complètes
2. Générer tous les bailleurs, immeubles, unités, locataires
3. Créer des contrats et associer les unités
4. Générer l'historique des paiements (85% payés, 15% impayés)
5. Créer des dépenses aléatoires

**Durée estimée** : 1-2 minutes

### Sortie Console

Le script affiche une progression détaillée :

```
🌱 Démarrage du seed des données de test...

📦 Création agence: Immobilier Dakar Premium (small)
  ✅ Agence créée: 123e4567-e89b-12d3-a456-426614174000
  📝 Création de 2 bailleurs...
  ✅ 2 bailleurs créés
  🏢 Création de 3 immeubles...
  ✅ 3 immeubles créés
  🏠 Création des unités...
  ✅ 30 unités créées
  👤 Création de 6 locataires...
  ✅ 6 locataires créés
  📄 Création de 8 contrats...
  ✅ 8 contrats créés
  ✅ Statuts des unités mis à jour
  💰 Création des paiements (3 mois)...
  ✅ 24 paiements créés
  💸 Création de 5 dépenses...
  ✅ 5 dépenses créées

✅ Agence Immobilier Dakar Premium complétée!
   - 2 bailleurs
   - 3 immeubles
   - 30 unités
   - 6 locataires
   - 8 contrats
   - 24 paiements
   - 5 dépenses

[... même processus pour les 2 autres agences ...]

🎉 SEED TERMINÉ AVEC SUCCÈS!

📊 Résumé:
   - 3 agences créées
   - Petite agence: données de test basiques
   - Agence moyenne: cas d'usage réalistes
   - Grande agence: test de performance et cas limites
```

## Tests Possibles Après le Seed

### 1. Dashboard
- Vérifier les statistiques globales
- Tester les graphiques de revenus mensuels
- Valider le taux d'occupation

### 2. Listes et Filtres
- Bailleurs : Trier, rechercher, paginer
- Immeubles : Filtrer par bailleur, ville, quartier
- Unités : Filtrer par type, statut, loyer
- Locataires : Recherche par nom, téléphone
- Contrats : Filtrer par statut, date

### 3. Filtres Avancés
- Combiner plusieurs critères
- Exporter en Excel
- Tester les performances avec la grande agence

### 4. Loyers Impayés
- Vérifier la détection automatique des impayés
- Filtrer par bailleur
- Exporter le rapport PDF

### 5. Rapports
- Rapport par immeuble : Revenus, impayés, commission
- Bilans mensuels par bailleur
- Export PDF personnalisé

### 6. Comptabilité
- Vue consolidée des revenus (commissions)
- Total des dépenses
- Solde net
- Graphiques d'évolution

### 7. Paiements
- Enregistrer un nouveau paiement
- Vérifier le calcul automatique des commissions
- Modifier un paiement existant

### 8. Performance
- Charger la grande agence (70+ contrats, 180+ unités)
- Tester la pagination
- Vérifier les temps de chargement

## Nettoyage des Données

Pour supprimer toutes les données de test :

```sql
-- ⚠️ ATTENTION : Cette commande supprime TOUTES les données !
-- À exécuter uniquement dans un environnement de développement

DELETE FROM paiements;
DELETE FROM contrats;
DELETE FROM unites;
DELETE FROM immeubles;
DELETE FROM locataires;
DELETE FROM bailleurs;
DELETE FROM depenses;
DELETE FROM agency_settings WHERE agency_id IN (
  SELECT id FROM agencies WHERE name LIKE '%Premium%'
  OR name LIKE '%Sénégal Gestion%'
  OR name LIKE '%Teranga%'
);
DELETE FROM agencies WHERE name LIKE '%Premium%'
  OR name LIKE '%Sénégal Gestion%'
  OR name LIKE '%Teranga%';
```

## Structure du Script

Le script est organisé en modules :

1. **Générateurs de données** : Fonctions pour créer des noms, téléphones, emails réalistes
2. **Générateurs d'entités** : Une fonction par entité (bailleurs, immeubles, etc.)
3. **Logique métier** : Calcul des commissions, gestion des statuts, cohérence relationnelle
4. **Insertion par lots** : Optimisation pour les gros volumes (paiements)

## Personnalisation

Vous pouvez modifier les constantes en début de fichier :

```javascript
// Nombre de données par type d'agence
const sizes = {
  small: { bailleurs: 2, immeubles: 3, locataires: 6, contrats: 8, mois: 3, depenses: 5 },
  medium: { bailleurs: 5, immeubles: 8, locataires: 20, contrats: 25, mois: 9, depenses: 15 },
  large: { bailleurs: 12, immeubles: 20, locataires: 60, contrats: 70, mois: 12, depenses: 30 }
};

// Taux d'impayés (actuellement 15%)
const aPaye = Math.random() > 0.15;

// Taux de contrats actifs (actuellement 90%)
const isActif = Math.random() > 0.1;
```

## Dépannage

### Erreur "Variables requises"
Vérifiez que votre fichier `.env` contient bien `VITE_SUPABASE_URL` et au moins une des clés API.

### Erreur RLS
Si vous obtenez des erreurs de type "violates row-level security policy", ajoutez `SUPABASE_SERVICE_ROLE_KEY` dans votre `.env`.

### Erreur de relation
Si vous obtenez des erreurs de foreign key, vérifiez que toutes les migrations ont été appliquées.

### Données dupliquées
Le script ne vérifie pas les doublons. Lancez le nettoyage SQL avant de re-seeder.

## Support

Pour toute question ou problème :
1. Vérifiez que toutes les migrations sont appliquées
2. Vérifiez les logs console pour identifier l'étape qui échoue
3. Contactez l'équipe de développement avec les logs d'erreur
