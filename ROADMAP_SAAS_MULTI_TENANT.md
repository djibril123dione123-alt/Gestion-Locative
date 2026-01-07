# 🚀 Roadmap SaaS Multi-Tenant - Gestion Locative

## Date : 7 janvier 2026

---

## 📋 RÉSUMÉ EXÉCUTIF

L'application "Gestion Locative / Confort Immo Archi" est actuellement une application **mono-tenant** fonctionnelle avec 12 pages opérationnelles.

L'objectif est de la transformer en un **SaaS multi-tenant** permettant à plusieurs agences immobilières et bailleurs individuels de s'inscrire et d'utiliser l'application de manière isolée et sécurisée.

### Objectifs stratégiques
1. ✅ **Monétisation** : Proposer 3 plans (Basic, Pro, Enterprise)
2. ✅ **Scalabilité** : Architecture multi-tenant avec isolation des données
3. ✅ **Autonomie** : Personnalisation sans code (logo, couleurs, paramètres)
4. ✅ **Marché** : Cibler le marché africain (Sénégal) avec adaptation locale
5. ✅ **Expérience** : Onboarding guidé et UX moderne

---

## 📊 ÉTAT ACTUEL VS ÉTAT CIBLE

### Pages existantes (12)
- ✅ Dashboard
- ✅ Bailleurs
- ✅ Immeubles
- ✅ Unités
- ✅ Locataires
- ✅ Contrats
- ✅ Paiements (Encaissements)
- ✅ Dépenses
- ✅ Commissions
- ✅ Loyers Impayés
- ✅ Filtres Avancés
- ✅ Rapports Financiers Détaillés

### Composants UX créés (Sprint 2)
- ✅ `translateSupabaseError()` - Traduction des erreurs en français
- ✅ `ConfirmModal` - Modal de confirmation réutilisable
- ✅ `Toast` + `useToast` - Système de notifications
- ✅ `getSuccessMessage()` - Messages de succès standardisés

### Architecture actuelle
- ✅ Supabase (PostgreSQL + Auth + RLS)
- ✅ React + TypeScript + Vite
- ✅ Tailwind CSS
- ✅ 4 rôles (Admin, Agent, Comptable, Bailleur)
- ✅ RLS activé sur toutes les tables
- ❌ **Mono-tenant** (une seule agence)

---

## 🎯 TRANSFORMATION MULTI-TENANT

### 26 nouvelles pages à développer

#### PRIORITÉ 1 - Authentification & Onboarding (12 pages)
1. **Page d'accueil publique** - Landing page marketing
2. **Choix du type de compte** - Agence ou Bailleur
3. **Inscription Agence** - Formulaire 3 étapes
4. **Inscription Bailleur** - Formulaire 2 étapes
5. **Onboarding Wizard Agence** - 4 écrans guidés
6. **Onboarding Wizard Bailleur** - 3 écrans guidés
7. **Réinitialisation mot de passe** - 2 pages
8. **Mon Profil** - Gestion profil utilisateur
9. **Paramètres Agence** - Personnalisation (logo, couleurs, etc.)
10. **Gestion des Utilisateurs** - Inviter et gérer l'équipe
11. **Rôles et Permissions** - Matrice de permissions
12. **Facturation et Abonnement** - Gestion des plans

#### PRIORITÉ 2 - Modules Métier (6 pages)
13. **Inventaires** - États des lieux (entrée/sortie)
14. **Interventions** - Maintenance et réparations (Kanban)
15. **Documents** - Gestion documentaire centralisée
16. **Notifications** - Centre de notifications
17. **Rapports Avancés** - Rapports personnalisés
18. **Calendrier** - Planning des événements

#### PRIORITÉ 3 - Légal (3 pages)
19. **CGU** - Conditions générales d'utilisation
20. **Politique de confidentialité** - RGPD
21. **Aide & Documentation** - Centre d'aide

#### PRIORITÉ 4 - Administration (5 pages)
22. **Audit Logs** - Journaux d'audit
23. **Dashboard Super Admin** - Vue globale
24. **Gestion des Agences** - Administration globale
25. **Gestion des Plans** - Tarifs et limites
26. **Statistiques Système** - Métriques et performance

---

## 🗄️ ARCHITECTURE BASE DE DONNÉES

### 9 nouvelles tables à créer

1. **`agencies`** - Agences immobilières
   - Informations agence (nom, NINEA, logo, etc.)
   - Plan d'abonnement (basic/pro/enterprise)
   - Statut (active/suspended/trial)

2. **`invitations`** - Invitations d'utilisateurs
   - Email, rôle, token, expiration
   - Statut (pending/accepted/expired)

3. **`notifications`** - Notifications utilisateur
   - Type, titre, message, lien
   - Lu/non lu

4. **`documents`** - Gestion documentaire
   - Upload de fichiers
   - Organisation par dossier
   - Liaison avec entités (bailleur, immeuble, etc.)
   - Tags

5. **`inventaires`** - États des lieux
   - Type (entrée/sortie)
   - Pièces + état + photos
   - Équipements
   - Compteurs (eau, électricité, gaz)
   - Signatures digitales

6. **`interventions`** - Maintenance
   - Catégorie (plomberie, électricité, etc.)
   - Urgence (urgente/normale/basse)
   - Statut (à faire/en cours/terminé)
   - Prestataire, coûts
   - Photos avant/après

7. **`evenements`** - Calendrier
   - Type (paiement, contrat, intervention, rendez-vous)
   - Date, heure
   - Rappels

8. **`subscription_plans`** - Plans tarifaires
   - Limites (utilisateurs, immeubles, unités, stockage)
   - Prix (XOF, EUR, USD)

9. **`subscriptions`** - Abonnements
   - Lien agency ↔ plan
   - Période, statut
   - Stripe ID

### Modifications de tables existantes

**Ajout de `agency_id` sur :**
- `profiles` (utilisateurs)
- `agency_settings` (devient multi-tenant)
- `bailleurs`
- `immeubles`
- `unites`
- `locataires`
- `contrats`
- `paiements`
- `depenses`
- `audit_logs`

**Objectif :** Isolation complète des données par agence

---

## 📦 FICHIERS DE MIGRATION CRÉÉS

### 1. `MIGRATION_CRITIQUE_A_APPLIQUER.sql`
Migration P0 (à appliquer en premier) :
- Correction du typo `comission` → `commission`
- Ajout des colonnes manquantes
- Création de `agency_settings`
- Soft delete sur tables financières
- Triggers d'audit automatiques
- Contraintes de validation
- Vue matérialisée pour performance
- Fonction `get_loyers_impayes()`

### 2. `MIGRATION_MULTI_TENANT.sql` (NOUVEAU)
Migration complète pour le multi-tenant :
- Création de la table `agencies`
- Ajout de `agency_id` partout
- 9 nouvelles tables
- RLS sur toutes les nouvelles tables
- Politiques d'accès par agence
- Fonctions utilitaires
- Migration des données existantes vers agence par défaut

---

## 🎨 PLANS TARIFAIRES

### Plan Basic (15 000 XOF / 23 EUR / 25 USD par mois)
- 1 utilisateur
- 5 immeubles max
- 20 unités max
- 1 GB stockage
- Support email
- Modules de base

### Plan Pro (35 000 XOF / 53 EUR / 58 USD par mois)
- 10 utilisateurs
- 50 immeubles max
- 200 unités max
- 5 GB stockage
- Tous les modules (Inventaires, Interventions, Documents)
- Support prioritaire

### Plan Enterprise (Sur devis)
- Utilisateurs illimités
- Immeubles illimités
- Unités illimitées
- 50 GB stockage
- API access
- Personnalisation avancée
- Support dédié
- Whitelabel (optionnel)

---

## 📅 ESTIMATION TEMPORELLE

### Phase 1 : Authentification & Onboarding (6-8 semaines)
**Semaines 1-2 :**
- Appliquer `MIGRATION_MULTI_TENANT.sql`
- Créer la landing page
- Page de choix de compte

**Semaines 3-4 :**
- Inscription Agence (formulaire 3 étapes)
- Inscription Bailleur (formulaire 2 étapes)
- Onboarding wizards

**Semaines 5-6 :**
- Mon Profil
- Paramètres Agence
- Gestion des Utilisateurs

**Semaines 7-8 :**
- Facturation et Abonnement
- Intégration Stripe (ou Wave/Orange Money)
- Tests E2E

### Phase 2 : Modules Métier (4-6 semaines)
**Semaines 9-10 :**
- Inventaires (états des lieux)
- Documents (upload + organisation)

**Semaines 11-12 :**
- Interventions (Kanban)
- Notifications

**Semaines 13-14 :**
- Calendrier
- Rapports Avancés

### Phase 3 : Légal & Documentation (1-2 semaines)
**Semaines 15-16 :**
- CGU
- Politique de confidentialité
- Centre d'aide

### Phase 4 : Administration (3-4 semaines)
**Semaines 17-20 :**
- Dashboard Super Admin
- Gestion des Agences
- Audit Logs
- Statistiques Système

---

## 🛠️ COMPOSANTS À CRÉER

### Nouveaux composants UI
- **Stepper** - Pour les wizards multi-étapes
- **FileUpload** - Drag & drop pour upload de fichiers
- **DatePicker** - Sélecteur de date moderne
- **ColorPicker** - Sélecteur de couleur pour branding
- **KanbanBoard** - Pour les interventions
- **Calendar** - Composant calendrier
- **RichTextEditor** - Éditeur de texte enrichi

### Hooks personnalisés
- ✅ `useToast` (déjà créé)
- `useAgency` - Récupérer l'agence de l'utilisateur
- `useSubscription` - Vérifier les limites du plan
- `useNotifications` - Gérer les notifications
- `useFileUpload` - Upload de fichiers vers Supabase Storage

---

## 🔐 SÉCURITÉ & RLS

### Principes
1. **Isolation par agence** : Chaque requête filtre par `agency_id`
2. **RLS activé partout** : Aucune requête ne peut bypasser les politiques
3. **Vérification des limites** : Le plan définit les quotas (utilisateurs, immeubles, unités)
4. **Audit trail** : Toutes les actions critiques sont loggées
5. **Soft delete** : Pas de suppression physique des données financières

### Politiques RLS type
```sql
-- Lecture : Uniquement les données de son agence
CREATE POLICY "Users can view agency data"
  ON table_name FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Écriture : Uniquement si Admin ou Agent
CREATE POLICY "Admins and agents can create"
  ON table_name FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );
```

---

## 🌍 ADAPTATION MARCHÉ AFRICAIN

### Mobile Money
- ✅ Wave (Sénégal)
- ✅ Orange Money
- ✅ Free Money
- Instructions de paiement personnalisées

### Localisation
- ✅ Devise XOF par défaut
- ✅ Format de date DD/MM/YYYY
- ✅ Langue française
- ✅ Numéros de téléphone format +221

### Performance
- Compression des images
- Lazy loading
- Optimisation mobile (4G instable)
- Mode hors ligne (optionnel)

---

## 🧪 TESTS À PRÉVOIR

### Tests Unitaires
- Composants UI (Toast, Modal, ConfirmModal)
- Fonctions utilitaires (translateSupabaseError, etc.)
- Hooks personnalisés

### Tests d'Intégration
- Flows d'inscription (Agence, Bailleur)
- Onboarding wizards
- CRUD des entités principales
- Génération de rapports PDF

### Tests E2E (Cypress ou Playwright)
- Parcours complet : Inscription → Onboarding → Création entités
- Multi-tenant : Vérifier l'isolation des données
- Limites de plan : Bloquer au-delà des quotas
- Paiement : Upgrade de plan

---

## 📈 MÉTRIQUES DE SUCCÈS

### Métriques Produit
- Nombre d'inscriptions (agences + bailleurs)
- Taux de conversion (visite → inscription)
- Taux d'activation (inscription → utilisation)
- Taux de rétention (utilisation à J+30)
- NPS (Net Promoter Score)

### Métriques Business
- MRR (Monthly Recurring Revenue)
- Churn rate (taux d'annulation)
- LTV (Lifetime Value)
- CAC (Customer Acquisition Cost)
- Répartition par plan (Basic / Pro / Enterprise)

### Métriques Techniques
- Uptime (objectif : 99,9%)
- Temps de réponse moyen (objectif : < 500ms)
- Taux d'erreur (objectif : < 0,1%)
- Utilisation de la base de données

---

## 📝 DOCUMENTATION CRÉÉE

1. ✅ **CORRECTIONS_EFFECTUEES.md** - Corrections P0 effectuées
2. ✅ **PLAN_AMELIORATIONS_PRIORITAIRES.md** - Roadmap 8 semaines
3. ✅ **AMELIORATIONS_UX_SPRINT2.md** - Améliorations UX Sprint 2
4. ✅ **PAGES_A_DEVELOPPER_COMPLET.md** - Liste complète 26 pages (CE DOCUMENT)
5. ✅ **MIGRATION_MULTI_TENANT.sql** - Migration complète multi-tenant
6. ✅ **ROADMAP_SAAS_MULTI_TENANT.md** - Ce document récapitulatif

---

## ✅ PROCHAINES ACTIONS IMMÉDIATES

### 1. Appliquer les migrations (URGENT)
```bash
# Dans Supabase Dashboard > SQL Editor
# Exécuter dans l'ordre :
1. MIGRATION_CRITIQUE_A_APPLIQUER.sql
2. MIGRATION_MULTI_TENANT.sql
```

### 2. Créer la landing page
- Design marketing avec Tailwind CSS
- 3 sections : Hero, Bénéfices, Tarifs
- CTA : "Créer un compte Agence" / "Créer un compte Bailleur"

### 3. Développer les pages d'inscription
- Inscription Agence (3 étapes)
- Inscription Bailleur (2 étapes)
- Choix du type de compte

### 4. Implémenter l'onboarding
- Wizard Agence (4 écrans)
- Wizard Bailleur (3 écrans)

### 5. Paramètres Agence
- Personnalisation (logo, couleurs, etc.)
- Configuration modules
- Mobile Money

---

## 🎯 VISION À LONG TERME

### Année 1 : Établissement
- Lancer le SaaS multi-tenant
- Acquérir 50 agences au Sénégal
- Stabiliser le produit

### Année 2 : Expansion
- Expansion géographique (Côte d'Ivoire, Mali, Burkina)
- Application mobile (React Native)
- Marketplace de prestataires (plombiers, électriciens)

### Année 3 : Écosystème
- API publique
- Intégrations tierces (comptabilité, banques)
- Whitelabel pour grandes agences
- IA pour prédiction d'impayés

---

## 💡 CONSEILS DE MISE EN ŒUVRE

### Architecture
- Suivre le principe DRY (Don't Repeat Yourself)
- Créer des composants réutilisables
- Centraliser la logique métier dans des hooks
- Utiliser TypeScript strictement

### Performance
- Lazy loading des pages
- Code splitting avec dynamic imports
- Optimisation des images (WebP, compression)
- Mise en cache avec React Query

### Sécurité
- Ne jamais exposer les secrets côté client
- Valider toutes les entrées (client + serveur)
- RLS activé et testé sur toutes les tables
- Audit logs pour toutes les actions critiques

### UX
- Feedback visuel immédiat (toasts)
- États de chargement clairs
- Messages d'erreur en français et compréhensibles
- Mobile-first design

---

## 🚀 CONCLUSION

La transformation en SaaS multi-tenant est un projet ambitieux mais parfaitement réalisable avec :
- ✅ Une architecture solide déjà en place
- ✅ Une roadmap claire et priorisée
- ✅ Des migrations SQL prêtes à l'emploi
- ✅ Un marché cible identifié (Afrique francophone)

**Estimation globale : 14-20 semaines (3,5 à 5 mois)**

**ROI estimé :**
- 50 agences × 35 000 XOF/mois = 1 750 000 XOF/mois (2 670 EUR/mois)
- Année 1 : ~32 000 EUR
- Coût développement : ~20 000 EUR
- Breakeven : 8 mois

---

**Document créé le :** 7 janvier 2026
**Auteur :** Claude (Sonnet 4.5)
**Version :** 1.0
**Statut :** Prêt pour validation et mise en œuvre
