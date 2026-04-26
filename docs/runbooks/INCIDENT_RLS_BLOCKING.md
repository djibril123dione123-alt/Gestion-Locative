# Runbook - Incident: Supabase RLS Policy Bloquant

**Auteur**: Équipe DevOps | **Date**: 2026-04-26 | **Criticité**: CRITICAL

## 1. Symptômes

- Erreur "permission denied" en console
- Aucune donnée ne charge (dashboard vide)
- Impossible de créer/modifier/supprimer des enregistrements
- Erreur Supabase: "row security policy violation"

## 2. Diagnostic rapide

```bash
# 1. Vérifier Supabase Status
curl -s https://status.supabase.com/ | grep -i incidents

# 2. Consulter les logs Sentry
# Sentry Dashboard > Issues > Filter by "row level security" ou "permission"

# 3. Tester l'API directement
curl -X GET "https://znvcfjelmikprjeoxrug.supabase.co/rest/v1/agencies?limit=1" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "apikey: $ANON_KEY"
# Vérifier la réponse: doit être JSON, pas 403

# 4. Vérifier le user_id de l'utilisateur authentifié
# Console browser > localStorage > auth token
# Décoder le JWT pour voir le user_id et les claims
```

## 3. Causes courantes et solutions

### Cause: RLS policy manquante ou mal configurée

**Symptômes**: Erreur 403 "row level security policy violation"

**Solution**:
```bash
# 1. Aller dans Supabase Dashboard > Authentication > Policies
# 2. Pour chaque table, vérifier les policies:
#    - SELECT: doit avoir `auth.uid() = user_id`
#    - INSERT: doit vérifier `auth.uid()`
#    - UPDATE: doit vérifier `auth.uid()`
#    - DELETE: doit vérifier `auth.uid()`

# 3. Vérifier que l'utilisateur a un profil user_profiles
SELECT * FROM user_profiles WHERE id = 'user-uuid-here';

# 4. Si policy manquante, créer une nouvelle:
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agencies"
  ON agencies
  FOR SELECT
  USING (auth.uid() = owner_id);
```

### Cause: User n'est pas authentifié

**Symptômes**: RLS refuse l'accès même avec policy correcte

**Solution**:
```bash
# 1. Vérifier la session de l'utilisateur
# Console browser > localStorage.auth.currentSession

# 2. Si absent ou expiré:
# - Forcer logout: localStorage.clear()
# - Rediriger vers /login
# - L'utilisateur doit se reconnecter

# 3. Vérifier le token dans Sentry:
# - Issues > Error details
# - Chercher "auth.uid() is NULL" ou similar

# 4. Vérifier la configuration VITE_SUPABASE_ANON_KEY:
# Vercel > Settings > Environment Variables
# Doit être la clé anonyme de Supabase (pas la service role)
```

### Cause: Mauvaise colonne pour le filtrage multi-tenant

**Symptômes**: Utilisateur voit les données des autres agences

**Solution**:
```bash
# 1. Vérifier la structure RLS pour multi-tenant
# Chaque table métier doit avoir:
#    - Colonne `agency_id`
#    - Policy qui filtre par agency_id de l'utilisateur

# 2. Vérifier user_profiles.agency_id
SELECT id, email, agency_id FROM user_profiles WHERE id = 'user-uuid';

# 3. Créer/mettre à jour la policy:
CREATE POLICY "Users can view their agency's contracts"
  ON contracts
  FOR SELECT
  USING (
    agency_id = (
      SELECT agency_id FROM user_profiles WHERE id = auth.uid()
    )
  );

# 4. Tester la policy:
SELECT * FROM contracts WHERE auth.uid() IN (
  SELECT id FROM user_profiles WHERE agency_id = contracts.agency_id
);
```

### Cause: Policy too restrictive ou avec typo

**Symptômes**: Erreur "no rows returned" même avec données

**Solution**:
```bash
# 1. Vérifier la policy exactement
# Supabase Dashboard > Table > Policies > Afficher la policy

# 2. Vérifier les noms de colonnes (case-sensitive!)
#    - Typo commune: `auth.uuid()` au lieu de `auth.uid()`

# 3. Tester avec SQL directement:
# Supabase SQL Editor > Exécuter sans RLS:
SELECT * FROM agencies;

# Puis vérifier la policy:
SELECT * FROM agencies  -- Avec RLS, doit filtrer

# 4. Si toujours problème, désactiver RLS temporairement:
ALTER TABLE agencies DISABLE ROW LEVEL SECURITY;
# ⚠️ À ne faire qu'en dev pour diagnostiquer!
# Réactiver immédiatement après:
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
```

## 4. Escalade

### Si l'incident n'est pas résolu après 10 min:

1. **Alerter immédiatement**
   - Slack #samay-keur-critical
   - Le système est bloqué, aucun utilisateur ne peut accéder

2. **Actions d'urgence**
   - Désactiver RLS temporairement (dev only)
   - Rollback du dernier changement de politique RLS:
     ```bash
     # Dans Supabase Dashboard:
     # SQL Editor > Voir l'historique des modifications
     # Exécuter la version précédente fonctionnelle
     ```

3. **Support Supabase**
   - Si Supabase a changé les RLS sans notification
   - Contacter support.supabase.io avec les logs

## 5. Récupération

### Étapes de vérification

```bash
# 1. Vérifier que SELECT fonctionne
SELECT * FROM agencies LIMIT 1;

# 2. Vérifier que INSERT fonctionne (si applicable)
INSERT INTO agencies (name, owner_id) VALUES ('Test', 'uuid');

# 3. Tester depuis le navigateur
- Ouvrir DevTools > Console
- Essayer de charger les données
- Vérifier qu'aucune erreur 403

# 4. Vérifier Sentry
- Issues > Moins d'erreurs RLS
- Attendre 5 min et vérifier que le nombre diminue

# 5. Tester les flux utilisateur critiques
- Login avec test account
- Voir les données
- Créer un enregistrement
```

### Communication

```
Slack #samay-keur-alerts:
"✅ RLS incident résolu. 
 Cause: [POLICY NAME] était mal configurée
 Action: [FIXED/ROLLED BACK]
 Impact: [N utilisateurs affectés pendant X min]
 Monitoring: Sentry actif"
```

## 6. Prévention

- ✅ Tester les RLS policies avant chaque déploiement
- ✅ Documenter la intention de chaque policy
- ✅ Utiliser les migrations SQL versionnées
- ✅ Tester les permissions par rôle (user, admin, super_admin)
- ✅ Monitorer les 403 dans Sentry

## 7. Annexe: Debugging RLS

```sql
-- Voir toutes les policies
SELECT * FROM pg_policies;

-- Voir les policies pour une table
SELECT * FROM pg_policies WHERE tablename = 'agencies';

-- Tester si une policy s'applique (simule auth.uid())
-- À faire dans Supabase SQL Editor en tant que user spécifique
SELECT * FROM agencies;

-- Vérifier les permissions de l'utilisateur courant
SELECT granted_privileges 
FROM information_schema.role_column_grants 
WHERE grantee = current_user;
```