# Liste Complète des Pages à Développer - Gestion Locative SaaS Multi-Tenant

## Date : 7 janvier 2026

---

## 📊 ÉTAT ACTUEL DE L'APPLICATION

### Pages déjà existantes (12)
1. ✅ **LoginForm** - Connexion utilisateur
2. ✅ **Dashboard** - Tableau de bord général
3. ✅ **Bailleurs** - Gestion des propriétaires
4. ✅ **Immeubles** - Gestion des bâtiments
5. ✅ **Unités** - Gestion des appartements/locaux
6. ✅ **Locataires** - Gestion des locataires
7. ✅ **Contrats** - Gestion des contrats de location
8. ✅ **Paiements** - Enregistrement des loyers
9. ✅ **Depenses** - Gestion des dépenses
10. ✅ **Commissions** - Suivi des commissions agence
11. ✅ **LoyersImpayes** - Détection des impayés
12. ✅ **FiltresAvances** - Recherche multicritères
13. ✅ **TableauDeBordFinancierGlobal** - Rapports financiers détaillés

---

## 🎯 PAGES À DÉVELOPPER (26 PAGES)

---

## CATÉGORIE 1 : AUTHENTIFICATION & ONBOARDING (7 pages) - PRIORITÉ 1

### 1.1 Page d'Accueil Publique (Landing Page)
**Route :** `/`
**Accès :** Public (non connecté)

**Objectif :** Page marketing pour présenter le SaaS et inciter à l'inscription

**Contenu :**
- Hero section avec titre accrocheur et CTA
- Bénéfices principaux (3-4 sections)
- Tarifs (plans Basic, Pro, Enterprise)
- Témoignages clients
- FAQ
- Footer avec liens légaux

**Call-to-Actions :**
- Bouton "Créer un compte Agence"
- Bouton "Créer un compte Bailleur"
- Bouton "Se connecter" (en haut à droite)

**Technologies :**
- React + Tailwind CSS
- Animations avec Framer Motion (optionnel)
- Responsive mobile-first

---

### 1.2 Choix du Type de Compte
**Route :** `/inscription/choix`
**Accès :** Public

**Objectif :** Permettre à l'utilisateur de choisir entre compte Agence ou Bailleur

**Contenu :**
- 2 cartes côte à côte :
  - **Carte Agence** : "Je suis une agence immobilière"
    - Icône immeuble
    - Description : "Gérez plusieurs bailleurs et immeubles"
    - Fonctionnalités : Multi-utilisateurs, Comptabilité, Commissions
    - Bouton "S'inscrire en tant qu'Agence"

  - **Carte Bailleur** : "Je suis un propriétaire"
    - Icône maison
    - Description : "Gérez vos propres biens immobiliers"
    - Fonctionnalités : Suivi locataires, Loyers, Documents
    - Bouton "S'inscrire en tant que Bailleur"

**Redirection :**
- Agence → `/inscription/agence`
- Bailleur → `/inscription/bailleur`

---

### 1.3 Inscription Agence
**Route :** `/inscription/agence`
**Accès :** Public

**Objectif :** Créer un compte agence avec son premier utilisateur admin

**Formulaire (3 étapes) :**

**Étape 1 : Informations Agence**
- Nom de l'agence *
- NINEA (numéro d'identification) *
- Adresse complète *
- Téléphone *
- Email agence *
- Site web (optionnel)
- Logo (upload optionnel)

**Étape 2 : Responsable Agence (Admin)**
- Prénom *
- Nom *
- Email *
- Téléphone *
- Mot de passe * (min 8 caractères)
- Confirmation mot de passe *

**Étape 3 : Configuration Initiale**
- Devise (XOF / EUR / USD)
- Taux de commission global (%)
- Nombre d'immeubles estimé
- Accepter les CGU *
- Accepter la politique de confidentialité *

**Actions :**
1. Créer l'entrée dans `agencies` (nouvelle table)
2. Créer l'entrée dans `agency_settings` avec l'ID de l'agence
3. Créer l'utilisateur dans `auth.users`
4. Créer le profil dans `profiles` avec role='admin' et agency_id
5. Envoyer email de confirmation (optionnel)
6. Rediriger vers `/onboarding/bienvenue`

---

### 1.4 Inscription Bailleur
**Route :** `/inscription/bailleur`
**Accès :** Public

**Objectif :** Créer un compte bailleur individuel

**Formulaire (2 étapes) :**

**Étape 1 : Informations Personnelles**
- Prénom *
- Nom *
- Email *
- Téléphone *
- Adresse
- Pièce d'identité (CNI/Passeport)

**Étape 2 : Compte & Sécurité**
- Mot de passe * (min 8 caractères)
- Confirmation mot de passe *
- Accepter les CGU *
- Accepter la politique de confidentialité *

**Actions :**
1. Créer une agence "virtuelle" avec nom = "Bailleur - {Nom}"
2. Créer l'entrée dans `agency_settings`
3. Créer l'utilisateur dans `auth.users`
4. Créer le profil dans `profiles` avec role='bailleur'
5. Créer l'entrée dans `bailleurs` liée au profil
6. Envoyer email de confirmation (optionnel)
7. Rediriger vers `/onboarding/bienvenue-bailleur`

---

### 1.5 Onboarding Wizard (Agence)
**Route :** `/onboarding/bienvenue`
**Accès :** Authentifié (nouveau compte agence uniquement)

**Objectif :** Guider l'agence dans les premiers pas

**Étapes (4 écrans avec progression) :**

**Écran 1 : Bienvenue**
- Message de félicitations
- Aperçu des fonctionnalités
- Bouton "Commencer"

**Écran 2 : Créer votre premier bailleur**
- Formulaire simplifié :
  - Nom, Prénom, Téléphone, Commission
- Bouton "Créer" ou "Passer cette étape"

**Écran 3 : Ajouter votre premier immeuble**
- Formulaire simplifié :
  - Nom, Adresse, Bailleur (sélection)
- Bouton "Créer" ou "Passer cette étape"

**Écran 4 : Inviter votre équipe**
- Formulaire multi-entrées :
  - Email, Rôle (Agent/Comptable)
  - Bouton "+ Ajouter un membre"
- Bouton "Envoyer les invitations" ou "Terminer"

**Fin :** Rediriger vers `/dashboard` avec un toast de bienvenue

---

### 1.6 Onboarding Wizard (Bailleur)
**Route :** `/onboarding/bienvenue-bailleur`
**Accès :** Authentifié (nouveau compte bailleur uniquement)

**Objectif :** Guider le bailleur dans les premiers pas

**Étapes (3 écrans) :**

**Écran 1 : Bienvenue**
- Message personnalisé
- Aperçu des fonctionnalités
- Bouton "Commencer"

**Écran 2 : Ajouter votre premier bien**
- Formulaire simplifié :
  - Type (Immeuble/Villa/Terrain)
  - Nom, Adresse, Nombre d'unités
- Bouton "Créer" ou "Passer cette étape"

**Écran 3 : Créer votre première unité**
- Formulaire simplifié :
  - Type (Appartement/Bureau/Boutique)
  - Numéro, Loyer mensuel
- Bouton "Créer" ou "Terminer"

**Fin :** Rediriger vers `/dashboard` avec un toast de bienvenue

---

### 1.7 Réinitialisation Mot de Passe
**Routes :**
- `/mot-de-passe-oublie` - Demande de réinitialisation
- `/reinitialiser-mot-de-passe/:token` - Formulaire de réinitialisation

**Accès :** Public

**Page 1 : Demande**
- Champ email
- Bouton "Envoyer le lien"
- Message de confirmation après envoi

**Page 2 : Réinitialisation**
- Nouveau mot de passe *
- Confirmation mot de passe *
- Bouton "Réinitialiser"
- Redirection vers `/login` après succès

---

## CATÉGORIE 2 : GESTION DE PROFIL & PARAMÈTRES (5 pages) - PRIORITÉ 1

### 2.1 Mon Profil Utilisateur
**Route :** `/profil`
**Accès :** Authentifié (tous rôles)

**Objectif :** Gérer les informations personnelles de l'utilisateur connecté

**Sections :**

**Informations Personnelles**
- Photo de profil (upload)
- Prénom, Nom
- Email (non modifiable)
- Téléphone
- Adresse

**Sécurité**
- Bouton "Changer mon mot de passe" → Modal
  - Mot de passe actuel *
  - Nouveau mot de passe *
  - Confirmation *

**Préférences**
- Langue (Français / English)
- Fuseau horaire
- Format de date (DD/MM/YYYY / MM/DD/YYYY)
- Notifications email (toggle)

**Boutons :**
- "Enregistrer les modifications"
- "Annuler"

---

### 2.2 Paramètres Agence
**Route :** `/parametres/agence`
**Accès :** Admin uniquement

**Objectif :** Personnaliser l'agence (logo, nom, couleurs, commissions, etc.)

**Sections (6 onglets) :**

**1. Identité**
- Nom de l'agence *
- NINEA
- Adresse complète
- Téléphone
- Email
- Site web
- Logo (upload, max 2MB, PNG/JPG)
- Couleur primaire (color picker)

**2. Finances**
- Devise (XOF / EUR / USD)
- Commission globale (%)
- Commission personnalisée par bailleur (toggle)
- Pénalité de retard :
  - Montant fixe (XOF/EUR/USD)
  - Délai en jours

**3. Documents**
- Signature numérique (upload)
- Pied de page personnalisé (textarea)
- QR Code sur quittances (toggle)
- Format de date (DD/MM/YYYY / MM/DD/YYYY)

**4. Modules**
- Mode avancé actif (toggle)
  - Active : Dépenses, Rapports détaillés
- Module Dépenses actif (toggle)
- Module Inventaires actif (toggle)
- Module Interventions actif (toggle)
- Champs personnalisés locataire (0-5)

**5. Mobile Money**
- Wave actif (toggle)
- Orange Money actif (toggle)
- Free Money actif (toggle)
- Instructions de paiement (textarea)

**6. Intégrations**
- API Webhook URL
- API Key (générer/regénérer)
- Notifications Email actif (toggle)
- SMTP personnalisé (optionnel)
  - Serveur, Port, Username, Password

**Bouton :** "Enregistrer les paramètres" (toast de succès)

---

### 2.3 Gestion des Utilisateurs
**Route :** `/parametres/utilisateurs`
**Accès :** Admin uniquement

**Objectif :** Gérer les membres de l'équipe (agents, comptables)

**Contenu :**

**Liste des utilisateurs (Table)**
Colonnes :
- Photo
- Nom complet
- Email
- Rôle (Admin / Agent / Comptable)
- Statut (Actif / Inactif / Invitation en attente)
- Dernière connexion
- Actions (Modifier / Désactiver / Supprimer)

**Bouton :** "+ Inviter un utilisateur" → Modal

**Modal d'invitation :**
- Email *
- Rôle (Agent / Comptable) *
- Message personnalisé (optionnel)
- Bouton "Envoyer l'invitation"

**Modal de modification :**
- Email (non modifiable)
- Rôle (dropdown)
- Statut (Actif / Inactif)
- Bouton "Enregistrer"

---

### 2.4 Rôles et Permissions
**Route :** `/parametres/roles`
**Accès :** Admin uniquement

**Objectif :** Afficher et gérer les permissions par rôle

**Contenu :**

**Tableau des permissions (matrice)**

| Permission | Admin | Agent | Comptable | Bailleur |
|------------|-------|-------|-----------|----------|
| **Bailleurs** |
| - Créer | ✅ | ✅ | ❌ | ❌ |
| - Modifier | ✅ | ✅ | ❌ | ❌ |
| - Supprimer | ✅ | ✅ | ❌ | ❌ |
| - Voir | ✅ | ✅ | ✅ | ✅ |
| **Immeubles** |
| - Créer | ✅ | ✅ | ❌ | ❌ |
| - Modifier | ✅ | ✅ | ❌ | ✅ |
| - Supprimer | ✅ | ✅ | ❌ | ❌ |
| - Voir | ✅ | ✅ | ✅ | ✅ |
| **... (toutes les ressources)** |

**Note :** Cette page est en lecture seule pour l'instant. Les rôles sont fixes (pas de rôles personnalisés pour le moment).

---

### 2.5 Facturation et Abonnement
**Route :** `/parametres/facturation`
**Accès :** Admin uniquement

**Objectif :** Gérer l'abonnement et consulter les factures

**Sections :**

**1. Abonnement Actuel**
- Plan actuel (Basic / Pro / Enterprise)
- Prix mensuel
- Date de renouvellement
- Statut (Actif / Suspendu / Expiré)
- Bouton "Changer de plan"
- Bouton "Annuler l'abonnement"

**2. Méthode de Paiement**
- Carte bancaire enregistrée (masquée)
- Bouton "Modifier la carte"
- Wave / Orange Money (si activé)

**3. Historique des Factures**
Table :
- Date
- Description (Plan Pro - Janvier 2026)
- Montant
- Statut (Payée / En attente)
- Action (Télécharger PDF)

**4. Utilisation**
- Nombre d'immeubles : 12 / 50
- Nombre d'unités : 45 / 200
- Nombre d'utilisateurs : 3 / 10
- Espace de stockage : 500 MB / 5 GB

---

## CATÉGORIE 3 : MODULES MÉTIER MANQUANTS (6 pages) - PRIORITÉ 2

### 3.1 Inventaires (État des Lieux)
**Route :** `/inventaires`
**Accès :** Admin, Agent, Bailleur

**Objectif :** Gérer les états des lieux (entrée/sortie)

**Contenu :**

**Liste des inventaires (Table)**
Colonnes :
- Date
- Type (Entrée / Sortie)
- Immeuble
- Unité
- Locataire
- Statut (En cours / Terminé / Litige)
- Actions (Voir / Modifier / PDF / Supprimer)

**Bouton :** "+ Nouvel inventaire" → Modal

**Modal de création/édition :**

**Étape 1 : Informations Générales**
- Type (Entrée / Sortie) *
- Date *
- Contrat (sélection) *
- Présents :
  - Locataire (checkbox)
  - Propriétaire (checkbox)
  - Agent (checkbox)

**Étape 2 : État des Pièces**
Pour chaque pièce (ajout dynamique) :
- Nom de la pièce *
- État général (Excellent / Bon / Moyen / Mauvais)
- Observations (textarea)
- Photos (upload multiple)

**Liste de pièces prédéfinies :**
- Salon, Cuisine, Chambres (1-5), SDB, WC, Balcon, Terrasse, Cave, Parking

**Étape 3 : Équipements**
Checklist avec état :
- Portes (nombre, état)
- Fenêtres (nombre, état)
- Prises électriques (nombre, état)
- Luminaires (nombre, état)
- Sanitaires (nombre, état)
- Électroménager (liste, état)

**Étape 4 : Relevés de Compteurs**
- Électricité (kWh)
- Eau (m³)
- Gaz (m³)

**Étape 5 : Observations Finales**
- Observations générales (textarea)
- Réparations nécessaires (textarea)
- Montant de la caution retenue (si sortie)
- Signatures :
  - Locataire (signature digitale)
  - Propriétaire (signature digitale)
  - Agent (signature digitale)

**Actions :**
- "Enregistrer comme brouillon"
- "Terminer et générer le PDF"

**Page de détail :**
- Affichage complet de l'inventaire
- Galerie photos
- Bouton "Télécharger PDF"
- Bouton "Modifier" (si en cours)

---

### 3.2 Interventions / Maintenance
**Route :** `/interventions`
**Accès :** Admin, Agent, Bailleur

**Objectif :** Gérer les demandes de maintenance et réparations

**Contenu :**

**Vue Kanban (3 colonnes)**
- **À faire** (rouge)
- **En cours** (orange)
- **Terminé** (vert)

Drag & drop entre les colonnes

**Bouton :** "+ Nouvelle intervention" → Modal

**Filtres :**
- Immeuble
- Unité
- Urgence (Urgente / Normale / Basse)
- Catégorie
- Date

**Carte d'intervention :**
- Titre
- Immeuble - Unité
- Catégorie (Plomberie / Électricité / Peinture / etc.)
- Urgence (badge coloré)
- Date de création
- Assigné à (agent)
- Bouton "Voir détails"

**Modal de création/édition :**

**Informations**
- Titre *
- Description *
- Immeuble *
- Unité *
- Catégorie * (dropdown)
  - Plomberie
  - Électricité
  - Peinture
  - Serrurerie
  - Climatisation
  - Autre
- Urgence * (Urgente / Normale / Basse)

**Intervention**
- Demandé par (Locataire / Bailleur / Agent)
- Date de demande *
- Date souhaitée
- Assigné à (agent, dropdown)

**Prestataire**
- Nom du prestataire
- Téléphone
- Coût estimé
- Coût réel

**Suivi**
- Statut (À faire / En cours / Terminé)
- Date d'intervention
- Date de fin
- Photos (avant/après)
- Notes (textarea)

**Actions :**
- "Enregistrer"
- "Annuler"

**Page de détail :**
- Toutes les informations
- Historique des changements
- Galerie photos
- Commentaires (thread)
- Bouton "Marquer comme terminé"

---

### 3.3 Documents & Fichiers
**Route :** `/documents`
**Accès :** Admin, Agent, Bailleur

**Objectif :** Centraliser tous les documents (contrats, factures, photos, etc.)

**Contenu :**

**Vue en arborescence (Sidebar gauche)**
- 📁 Tous les documents
- 📁 Bailleurs
  - 📁 [Nom Bailleur 1]
  - 📁 [Nom Bailleur 2]
- 📁 Immeubles
  - 📁 [Nom Immeuble 1]
  - 📁 [Nom Immeuble 2]
- 📁 Contrats
- 📁 Inventaires
- 📁 Factures
- 📁 Photos
- 📁 Divers

**Vue principale (Grille ou Liste)**

**Vue Grille :**
- Miniatures des fichiers
- Nom du fichier
- Type (icône)
- Taille
- Date d'ajout

**Vue Liste (Table) :**
- Icône
- Nom
- Type
- Taille
- Date de modification
- Uploadé par
- Actions (Télécharger / Renommer / Déplacer / Supprimer)

**Boutons :**
- "+ Nouveau dossier"
- "📤 Uploader des fichiers" → Modal

**Modal d'upload :**
- Zone de drag & drop
- OU bouton "Parcourir"
- Lier à :
  - Bailleur (dropdown)
  - Immeuble (dropdown)
  - Unité (dropdown)
  - Contrat (dropdown)
- Tags (multi-sélection)
- Bouton "Uploader"

**Fonctionnalités :**
- Recherche full-text
- Filtres (type, date, taille)
- Prévisualisation (PDF, images)
- Tri (nom, date, taille)
- Sélection multiple
- Actions groupées (télécharger, supprimer)

---

### 3.4 Notifications
**Route :** `/notifications`
**Accès :** Authentifié (tous rôles)

**Objectif :** Centraliser toutes les notifications de l'application

**Contenu :**

**Liste des notifications**

Chaque notification contient :
- Icône (selon le type)
- Titre
- Message
- Date/heure
- Statut (Lue / Non lue)
- Action (lien vers la ressource)

**Types de notifications :**
- 💵 Nouveau paiement enregistré
- ⚠️ Loyer impayé détecté
- 📄 Nouveau contrat créé
- 🔧 Nouvelle intervention créée
- 👤 Nouveau locataire ajouté
- 🏢 Nouvel immeuble ajouté
- ✅ Intervention terminée
- 📊 Rapport mensuel disponible

**Filtres :**
- Toutes
- Non lues
- Type (dropdown)
- Date (range)

**Actions :**
- "Marquer toutes comme lues"
- "Supprimer les anciennes" (+ 30 jours)

**Badge :** Afficher le nombre de notifications non lues dans la Sidebar

---

### 3.5 Rapports Avancés
**Route :** `/rapports`
**Accès :** Admin, Comptable

**Objectif :** Générer des rapports personnalisés

**Contenu :**

**Types de rapports disponibles (cartes cliquables) :**

1. **Rapport de Revenus**
   - Période (mois/année)
   - Bailleur (tous ou sélection)
   - Export PDF/Excel

2. **Rapport d'Occupation**
   - Taux d'occupation global
   - Par immeuble
   - Évolution dans le temps

3. **Rapport des Impayés**
   - Liste des locataires en retard
   - Montants dus
   - Relances effectuées

4. **Rapport des Dépenses**
   - Par catégorie
   - Par immeuble
   - Comparaison mois/mois

5. **Rapport de Performance**
   - KPIs globaux
   - Comparaison périodes
   - Tendances

6. **Rapport Comptable**
   - Grand livre
   - Balance
   - Compte de résultat

**Filtres Communs :**
- Période (date de début, date de fin)
- Bailleur (multi-sélection)
- Immeuble (multi-sélection)
- Format export (PDF / Excel / CSV)

**Actions :**
- "Générer le rapport"
- "Programmer l'envoi" (email récurrent)

---

### 3.6 Calendrier / Planning
**Route :** `/calendrier`
**Accès :** Admin, Agent

**Objectif :** Vue calendrier des événements importants

**Contenu :**

**Vue Calendrier (mois/semaine/jour)**

**Types d'événements :**
- 💵 Échéances de paiement
- 📄 Fins de contrat
- 🔧 Interventions planifiées
- 📋 Inventaires programmés
- 📞 Rendez-vous
- 🎂 Anniversaires locataires (optionnel)

**Couleurs par type :**
- Paiements : vert
- Contrats : bleu
- Interventions : orange
- Rendez-vous : violet

**Bouton :** "+ Nouvel événement" → Modal

**Modal :**
- Titre *
- Type *
- Date *
- Heure (optionnel)
- Lié à (Bailleur / Immeuble / Unité / Locataire)
- Description
- Rappel (Aucun / 1 jour avant / 1 semaine avant)

**Actions :**
- Clic sur événement → Voir détails
- Drag & drop pour déplacer

---

## CATÉGORIE 4 : PAGES LÉGALES & INFORMATIVES (3 pages) - PRIORITÉ 3

### 4.1 Conditions Générales d'Utilisation (CGU)
**Route :** `/legal/cgu`
**Accès :** Public

**Contenu :**
- Texte légal complet des CGU
- Dernière mise à jour
- Possibilité de télécharger en PDF

---

### 4.2 Politique de Confidentialité
**Route :** `/legal/confidentialite`
**Accès :** Public

**Contenu :**
- Traitement des données personnelles (RGPD)
- Cookies
- Sécurité
- Droits des utilisateurs
- Contact DPO

---

### 4.3 Aide & Documentation
**Route :** `/aide`
**Accès :** Authentifié

**Contenu :**

**Recherche :** Barre de recherche pour trouver des articles

**Catégories :**
- 🚀 Premiers pas
- 👥 Gestion des bailleurs
- 🏢 Gestion des immeubles
- 📄 Contrats et locations
- 💰 Paiements et finances
- 🔧 Interventions
- ⚙️ Paramètres
- 📊 Rapports

**Chaque article contient :**
- Titre
- Description
- Captures d'écran
- Étapes détaillées
- Vidéo tutoriel (optionnel)

**Contact Support :**
- Formulaire de contact
- Email : support@gestion-locative.sn
- Téléphone : +221 XX XXX XX XX
- Chat en direct (optionnel)

---

## CATÉGORIE 5 : ADMINISTRATION AVANCÉE (5 pages) - PRIORITÉ 4

### 5.1 Audit Logs (Journaux d'Audit)
**Route :** `/admin/audit-logs`
**Accès :** Admin uniquement

**Objectif :** Tracer toutes les actions critiques

**Contenu :**

**Table des logs :**
- Date/heure
- Utilisateur
- Action (INSERT / UPDATE / DELETE)
- Table affectée
- ID enregistrement
- Anciennes valeurs (JSON)
- Nouvelles valeurs (JSON)
- Adresse IP
- Actions (Voir détails)

**Filtres :**
- Utilisateur
- Action
- Table
- Date (range)
- Recherche

**Export :** CSV

---

### 5.2 Tableau de Bord Super Admin
**Route :** `/admin/dashboard`
**Accès :** Super Admin (nouveau rôle)

**Objectif :** Vue globale de toutes les agences (multi-tenant)

**Contenu :**

**Statistiques Globales :**
- Nombre total d'agences
- Nombre total d'utilisateurs
- Nombre total d'immeubles
- Revenus mensuels totaux

**Liste des Agences :**
Table :
- Nom agence
- Plan (Basic / Pro / Enterprise)
- Nb utilisateurs
- Nb immeubles
- Statut (Actif / Suspendu / Trial)
- Date de création
- Actions (Voir / Modifier / Suspendre)

**Graphiques :**
- Évolution des inscriptions
- Répartition par plan
- Taux de rétention

---

### 5.3 Gestion des Agences (Super Admin)
**Route :** `/admin/agences`
**Accès :** Super Admin

**Objectif :** Gérer toutes les agences du système

**Fonctionnalités :**
- Créer une agence manuellement
- Modifier les informations d'une agence
- Changer le plan d'abonnement
- Suspendre/Réactiver une agence
- Supprimer une agence (soft delete)
- Se connecter en tant que (impersonation)

---

### 5.4 Gestion des Plans Tarifaires
**Route :** `/admin/plans`
**Accès :** Super Admin

**Objectif :** Définir les plans d'abonnement

**Plans :**

**Basic (Gratuit / 15 000 XOF/mois)**
- 1 utilisateur
- 5 immeubles max
- 20 unités max
- 500 MB stockage
- Support email

**Pro (35 000 XOF/mois)**
- 10 utilisateurs
- 50 immeubles max
- 200 unités max
- 5 GB stockage
- Tous les modules
- Support prioritaire

**Enterprise (Sur devis)**
- Utilisateurs illimités
- Immeubles illimités
- Unités illimitées
- 50 GB stockage
- API access
- Support dédié
- Personnalisation

**Fonctionnalités :**
- Modifier les prix
- Modifier les limites
- Activer/Désactiver un plan

---

### 5.5 Statistiques Système
**Route :** `/admin/statistiques`
**Accès :** Super Admin

**Objectif :** Métriques système et performance

**Contenu :**

**Performance Base de Données :**
- Nombre total d'enregistrements
- Taille de la base
- Requêtes les plus lentes
- Indexes manquants

**Performance Application :**
- Temps de réponse moyen
- Taux d'erreur
- Uptime
- Utilisation CPU/RAM

**Métriques Métier :**
- Nouveaux utilisateurs (jour/mois)
- Taux de conversion
- Taux de churn
- MRR (Monthly Recurring Revenue)
- LTV (Lifetime Value)

---

## 📋 RÉSUMÉ PAR PRIORITÉ

### ✅ PRIORITÉ 1 - ESSENTIEL (12 pages)
1. Page d'accueil publique
2. Choix du type de compte
3. Inscription Agence
4. Inscription Bailleur
5. Onboarding Wizard Agence
6. Onboarding Wizard Bailleur
7. Réinitialisation mot de passe
8. Mon Profil
9. Paramètres Agence
10. Gestion des Utilisateurs
11. Rôles et Permissions
12. Facturation et Abonnement

**Estimation :** 6-8 semaines

---

### ⚠️ PRIORITÉ 2 - IMPORTANT (6 pages)
13. Inventaires
14. Interventions
15. Documents
16. Notifications
17. Rapports Avancés
18. Calendrier

**Estimation :** 4-6 semaines

---

### 🔵 PRIORITÉ 3 - UTILE (3 pages)
19. CGU
20. Politique de confidentialité
21. Aide & Documentation

**Estimation :** 1-2 semaines

---

### 🟣 PRIORITÉ 4 - AVANCÉ (5 pages)
22. Audit Logs
23. Tableau de Bord Super Admin
24. Gestion des Agences
25. Gestion des Plans
26. Statistiques Système

**Estimation :** 3-4 semaines

---

## 🏗️ ARCHITECTURE MULTI-TENANT

### Nouvelles Tables à Créer

```sql
-- Table des agences
CREATE TABLE agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ninea text,
  address text,
  phone text,
  email text,
  website text,
  logo_url text,
  plan text DEFAULT 'basic', -- basic / pro / enterprise
  status text DEFAULT 'active', -- active / suspended / trial
  trial_ends_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Modifier table profiles pour ajouter agency_id
ALTER TABLE profiles ADD COLUMN agency_id uuid REFERENCES agencies(id);

-- Modifier agency_settings pour ajouter agency_id
ALTER TABLE agency_settings
  DROP CONSTRAINT IF EXISTS agency_settings_pkey,
  ADD COLUMN agency_id uuid REFERENCES agencies(id),
  ADD PRIMARY KEY (agency_id);

-- Table des invitations
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  agency_id uuid REFERENCES agencies(id),
  role text NOT NULL,
  status text DEFAULT 'pending', -- pending / accepted / expired
  token text UNIQUE,
  invited_by uuid REFERENCES profiles(id),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Table des notifications
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  type text NOT NULL,
  title text NOT NULL,
  message text,
  link text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Table des documents
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id),
  name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  folder text,
  bailleur_id uuid REFERENCES bailleurs(id),
  immeuble_id uuid REFERENCES immeubles(id),
  unite_id uuid REFERENCES unites(id),
  contrat_id uuid REFERENCES contrats(id),
  tags text[],
  uploaded_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Table des inventaires
CREATE TABLE inventaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_id uuid REFERENCES contrats(id),
  type text NOT NULL, -- entree / sortie
  date date NOT NULL,
  locataire_present boolean,
  proprietaire_present boolean,
  agent_present boolean,
  pieces jsonb, -- [{nom, etat, observations, photos}]
  equipements jsonb,
  compteurs jsonb, -- {electricite, eau, gaz}
  observations text,
  reparations text,
  caution_retenue decimal(10,2),
  signature_locataire text,
  signature_proprietaire text,
  signature_agent text,
  statut text DEFAULT 'en_cours', -- en_cours / termine / litige
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des interventions
CREATE TABLE interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titre text NOT NULL,
  description text,
  immeuble_id uuid REFERENCES immeubles(id),
  unite_id uuid REFERENCES unites(id),
  categorie text, -- plomberie / electricite / peinture / etc
  urgence text DEFAULT 'normale', -- urgente / normale / basse
  demande_par text, -- locataire / bailleur / agent
  date_demande date,
  date_souhaitee date,
  assigne_a uuid REFERENCES profiles(id),
  prestataire_nom text,
  prestataire_telephone text,
  cout_estime decimal(10,2),
  cout_reel decimal(10,2),
  statut text DEFAULT 'a_faire', -- a_faire / en_cours / termine
  date_intervention date,
  date_fin date,
  photos_avant text[],
  photos_apres text[],
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des événements (calendrier)
CREATE TABLE evenements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titre text NOT NULL,
  type text NOT NULL, -- paiement / contrat / intervention / rendez-vous
  date date NOT NULL,
  heure time,
  bailleur_id uuid REFERENCES bailleurs(id),
  immeuble_id uuid REFERENCES immeubles(id),
  unite_id uuid REFERENCES unites(id),
  locataire_id uuid REFERENCES locataires(id),
  description text,
  rappel text, -- aucun / 1_jour / 1_semaine
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
```

---

## 🎨 DESIGN SYSTEM À RESPECTER

**Couleurs :**
- Primaire : #F58220 (orange Confort)
- Secondaire : #C0392B (rouge Confort)
- Succès : #10B981 (vert)
- Erreur : #EF4444 (rouge)
- Avertissement : #F59E0B (orange)
- Info : #3B82F6 (bleu)

**Composants Réutilisables Déjà Créés :**
- ✅ Modal
- ✅ Table
- ✅ ConfirmModal
- ✅ Toast
- ✅ Sidebar

**Composants à Créer :**
- Stepper (pour wizards)
- FileUpload
- DatePicker
- ColorPicker
- Kanban Board
- Calendar
- Rich Text Editor

---

## 📊 ESTIMATION GLOBALE

**Total : 26 pages**

**Temps estimé par priorité :**
- Priorité 1 : 6-8 semaines
- Priorité 2 : 4-6 semaines
- Priorité 3 : 1-2 semaines
- Priorité 4 : 3-4 semaines

**TOTAL : 14-20 semaines (3,5 à 5 mois)**

---

## 🚀 PROCHAINES ÉTAPES

1. ✅ Valider cette liste avec le client
2. ⏳ Créer les migrations de base de données pour le multi-tenant
3. ⏳ Développer les pages de Priorité 1
4. ⏳ Tests et ajustements
5. ⏳ Déploiement progressif

---

**Document créé le :** 7 janvier 2026
**Dernière mise à jour :** 7 janvier 2026
**Version :** 1.0
