# Guide de Migration Multi-Tenant

## Vue d'ensemble

Le système est maintenant configuré en mode multi-tenant. Chaque agence a ses propres données isolées via `agency_id`.

## Architecture

### Base de données

Toutes les tables métier ont maintenant une colonne `agency_id` :
- `bailleurs`
- `immeubles`
- `unites`
- `locataires`
- `contrats`
- `paiements`
- `depenses`
- `audit_logs`

### Nouvelles tables

- `agencies` - Agences immobilières
- `invitations` - Invitations d'utilisateurs
- `notifications` - Notifications système
- `documents` - Gestion documentaire
- `inventaires` - États des lieux
- `interventions` - Maintenance
- `evenements` - Calendrier
- `subscription_plans` - Plans tarifaires
- `subscriptions` - Abonnements

## Flow d'utilisation

### 1. Premier accès (Onboarding)

Quand un utilisateur n'a pas d'`agency_id` :
- Il est redirigé vers `/welcome`
- Il choisit son type de compte (Agence ou Bailleur)
- Il configure son agence
- Un abonnement "Essai Gratuit" est créé (30 jours)
- Il est redirigé vers le dashboard

### 2. Utilisation normale

Une fois l'agence configurée :
- Toutes les requêtes filtrent automatiquement par `agency_id`
- Les données sont isolées par agence
- Les utilisateurs ne voient que les données de leur agence

## Modifications nécessaires dans le code

### Pattern à suivre pour toutes les pages

```typescript
import { useAuth } from '../contexts/AuthContext';

export function MaPage() {
  const { profile } = useAuth();

  useEffect(() => {
    if (profile?.agency_id) {
      loadData();
    }
  }, [profile?.agency_id]);

  const loadData = async () => {
    if (!profile?.agency_id) return;

    // SELECT avec filtre agency_id
    const { data } = await supabase
      .from('ma_table')
      .select('*')
      .eq('agency_id', profile.agency_id)
      .order('created_at', { ascending: false });
  };

  const createItem = async (itemData) => {
    if (!profile?.agency_id) return;

    // INSERT avec agency_id
    const { data, error } = await supabase
      .from('ma_table')
      .insert({
        ...itemData,
        agency_id: profile.agency_id
      });
  };
}
```

### Fichiers déjà migrés

✅ Dashboard.tsx - Complètement migré
✅ App.tsx - Flow d'onboarding ajouté
✅ AuthContext.tsx - Support agency_id
✅ supabase.ts - Type UserProfile mis à jour

### Fichiers partiellement migrés

Les fichiers suivants ont `profile` ajouté à `useAuth()` mais nécessitent encore les filtres `agency_id` :

🔄 Bailleurs.tsx
🔄 Immeubles.tsx
🔄 Unites.tsx
🔄 Locataires.tsx
🔄 Depenses.tsx

### Fichiers à migrer manuellement

Ces fichiers n'ont pas encore `useAuth` importé :

❌ Contrats.tsx
❌ Paiements.tsx
❌ Commissions.tsx
❌ LoyersImpayes.tsx
❌ FiltresAvances.tsx
❌ TableauDeBordFinancierGlobal.tsx

## Checklist par fichier

Pour chaque fichier, appliquer :

### 1. Import et hook
```typescript
import { useAuth } from '../contexts/AuthContext';

// Dans le composant
const { profile } = useAuth();
```

### 2. Modifier les SELECT
```typescript
// AVANT
const { data } = await supabase
  .from('table')
  .select('*');

// APRÈS
const { data } = await supabase
  .from('table')
  .select('*')
  .eq('agency_id', profile?.agency_id);
```

### 3. Modifier les INSERT
```typescript
// AVANT
const { data } = await supabase
  .from('table')
  .insert({
    nom: 'test'
  });

// APRÈS
const { data } = await supabase
  .from('table')
  .insert({
    nom: 'test',
    agency_id: profile?.agency_id
  });
```

### 4. Ajouter les guards
```typescript
const loadData = async () => {
  if (!profile?.agency_id) return; // IMPORTANT

  // reste du code...
};

useEffect(() => {
  if (profile?.agency_id) { // IMPORTANT
    loadData();
  }
}, [profile?.agency_id]); // IMPORTANT
```

## Plans tarifaires

### Basic (Essai Gratuit)
- 0 XOF/mois
- 30 jours d'essai
- 1 utilisateur
- 3 immeubles max
- 10 unités max

### Pro (Recommandé)
- 15 000 XOF/mois
- Utilisateurs illimités
- Immeubles illimités
- Unités illimitées
- Support prioritaire

### Enterprise
- Sur devis
- Fonctionnalités personnalisées
- API access
- Whitelabel

## Fonctions utilitaires

### check_plan_limits(agency_id)
Vérifie si l'agence peut ajouter plus d'utilisateurs/immeubles/unités :
```sql
SELECT check_plan_limits('agency-uuid');
```

Retourne :
```json
{
  "limits": { "max_users": 999, "max_immeubles": 999, "max_unites": 9999 },
  "usage": { "users": 5, "immeubles": 12, "unites": 45 },
  "can_add_user": true,
  "can_add_immeuble": true,
  "can_add_unite": true
}
```

### create_notification(user_id, agency_id, type, title, message, link)
Crée une notification pour un utilisateur

### cleanup_expired_invitations()
Nettoie les invitations expirées (à appeler périodiquement)

## Sécurité RLS

Toutes les tables ont RLS activé avec des politiques qui :
1. Filtrent automatiquement par `agency_id`
2. Vérifient le rôle de l'utilisateur (admin/agent/comptable/bailleur)
3. Empêchent l'accès inter-agences

## Prochaines fonctionnalités à développer

1. **Gestion des invitations** - Page pour inviter des utilisateurs
2. **Notifications** - Centre de notifications en temps réel
3. **Documents** - Gestionnaire de documents par bien
4. **Inventaires** - États des lieux d'entrée/sortie
5. **Interventions** - Kanban de maintenance
6. **Calendrier** - Vue calendrier des événements
7. **Facturation** - Intégration Stripe/Mobile Money
8. **Landing page** - Page publique d'inscription

## Support

Pour toute question sur la migration, consulter :
- `MIGRATION_MULTI_TENANT.sql` - Script SQL complet
- `CORRECTIONS_EFFECTUEES.md` - Liste des corrections
- `ROADMAP_SAAS_MULTI_TENANT.md` - Roadmap complète
