# Configuration de l'application Confort Immo Archi

## Création du compte administrateur

Pour créer le premier compte administrateur, suivez ces étapes :

### 1. Créer un utilisateur via Supabase Auth

Connectez-vous à votre tableau de bord Supabase et exécutez cette commande SQL :

```sql
-- Créer un utilisateur administrateur
-- Note: Remplacez 'admin@confortimmo.com' et 'votre_mot_de_passe' par vos valeurs

-- D'abord, créez l'utilisateur dans l'interface Auth de Supabase
-- Ensuite, récupérez son UUID et exécutez:

INSERT INTO user_profiles (id, email, nom, prenom, telephone, role, actif)
VALUES (
  'VOTRE_UUID_ICI',  -- UUID de l'utilisateur créé dans Auth
  'admin@confortimmo.com',
  'Admin',
  'Système',
  '+221 XX XXX XX XX',
  'admin',
  true
);
```

### 2. Méthode alternative - Créer via l'interface de l'application

1. Modifiez temporairement le fichier `src/pages/Dashboard.tsx` ou créez un script de seed
2. Utilisez la fonction `signUp` de Supabase pour créer le compte
3. Ajoutez automatiquement le profil avec le rôle 'admin'

### 3. Exemple de données de test

Une fois connecté en tant qu'admin, vous pouvez créer :

**Bailleurs:**
- Nom: Diop, Prénom: Mamadou, Téléphone: +221 77 123 45 67

**Immeubles:**
- Nom: Résidence Almadies, Adresse: Route des Almadies, Ville: Dakar

**Unités (Produits):**
- Nom: Appartement 101, Loyer: 250000 XOF

**Locataires:**
- Nom: Ndiaye, Prénom: Fatou, Téléphone: +221 76 987 65 43

**Contrats:**
- Associer un locataire à une unité avec un loyer mensuel

**Paiements:**
- Enregistrer les paiements mensuels avec calcul automatique de la commission

## Rôles disponibles

- **admin**: Accès complet à toutes les fonctionnalités
- **agent**: Gestion des bailleurs, immeubles, locataires, contrats et paiements
- **comptable**: Consultation des finances et rapports
- **bailleur**: Vue limitée à ses propres biens et paiements

## Fonctionnalités principales

### Tableau de bord
- Statistiques en temps réel
- Graphiques de revenus mensuels
- Taux d'occupation des unités
- Indicateurs financiers

### Gestion immobilière
- CRUD complet pour bailleurs, immeubles, unités, locataires
- Gestion des contrats de location
- Suivi des paiements avec calcul automatique des commissions

### Comptabilité
- Revenus et dépenses
- Bilans mensuels
- Export PDF et Excel
- Graphiques d'évolution

### Sécurité
- Authentification par email/mot de passe
- Row Level Security (RLS) sur toutes les tables
- Permissions basées sur les rôles
- Audit logs pour traçabilité

## Support

Pour toute question ou assistance, contactez l'équipe de développement.
