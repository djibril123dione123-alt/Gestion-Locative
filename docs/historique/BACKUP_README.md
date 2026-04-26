# Sauvegarde Automatique Supabase

## Vue d'ensemble

Cette documentation explique la stratégie de sauvegarde pour la base de données Supabase.

## Configuration

### 1. Script de sauvegarde local

Le fichier `scripts/backup-supabase.sh` crée des sauvegardes locales:

```bash
./scripts/backup-supabase.sh
```

**Variables d'environnement requises:**
- `SUPABASE_URL`: L'URL de votre projet Supabase
- `SUPABASE_SERVICE_KEY`: La clé de service Supabase (secrète)

**Conservation**: 30 jours par défaut (modifiable avec `RETENTION_DAYS`)

### 2. Automatisation avec GitHub Actions

Le workflow `.github/workflows/backup.yml` crée des sauvegardes quotidiennes à 2h UTC:

```bash
# Déclencher manuellement
gh workflow run backup.yml
```

## Configuration sur GitHub

### Ajouter les secrets GitHub

Allez dans **Settings > Secrets and variables > Actions** et ajoutez:

1. **VITE_SUPABASE_URL**
   - Récupérable dans le dashboard Supabase > Settings > API
   - Format: `https://project-id.supabase.co`

2. **SUPABASE_SERVICE_ROLE_KEY**
   - ⚠️ **SENSIBLE** - Ne jamais commiter ce secret
   - Récupérable dans Supabase > Settings > API > Service role key
   - Cette clé a accès complet à la base de données

3. **SUPABASE_PROJECT_ID** (optionnel)
   - L'ID de votre projet Supabase
   - Extrait automatiquement de l'URL si non fourni

4. **AWS credentials** (optionnel - pour le stockage sur S3)
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`
   - `BACKUP_BUCKET`: Le nom de votre bucket S3

## Stratégie de sauvegarde

### Fréquence
- **Locale**: À la demande via `./scripts/backup-supabase.sh`
- **GitHub Actions**: Tous les jours à 2h UTC
- **Considérer**: Une sauvegarde horaire pour la production critique

### Rétention
- **GitHub Artifacts**: 30 jours (configurable)
- **Stockage local**: 30 jours (modifiable via `RETENTION_DAYS`)
- **S3** (si configuré): Selon votre stratégie AWS

### Emplacement
1. **Local** (développement): `.backups/backup_YYYYMMDD_HHMMSS.sql.gz`
2. **GitHub Artifacts** (CI/CD): Accessible via Actions > Backup > Artifacts
3. **S3** (optionnel production): `s3://bucket-name/samay-keur/`

## Procédure de restauration

### Depuis une sauvegarde locale

```bash
# 1. Décompresser la sauvegarde
gunzip backup_20260426_120000.sql.gz

# 2. Restaurer dans Supabase
# Via SQL Editor dans le dashboard Supabase:
# - Ouvrir SQL Editor
# - Copier le contenu du fichier .sql
# - Exécuter

# Ou via psql (si pg_dump a été utilisé):
PGPASSWORD=$SUPABASE_SERVICE_KEY psql \
  -h project-id.db.supabase.co \
  -U postgres \
  -d postgres \
  -f backup_20260426_120000.sql
```

### Depuis GitHub Artifacts

1. Aller sur GitHub > Actions > Workflow "Backup Database"
2. Sélectionner le backup désiré
3. Cliquer "Download artifact"
4. Suivre les mêmes étapes que ci-dessus

## Bonnes pratiques

### Avant la production

- ✅ Tester la restauration d'une sauvegarde dans un environnement de test
- ✅ Documenter la procédure de restauration
- ✅ Configurer les alertes si une sauvegarde échoue
- ✅ Tester le RTO (Recovery Time Objective) souhaité

### Pour la sécurité

- ✅ Jamais commiter des clés de service
- ✅ Utiliser les secrets GitHub Actions
- ✅ Limiter l'accès aux backups (stockage sécurisé)
- ✅ Chiffrer les backups sensibles
- ✅ Tester régulièrement la restauration

### Pour la conformité

- 📋 Documenter votre stratégie de sauvegarde
- 📋 Vérifier les exigences légales (RGPD, etc.)
- 📋 Conserver les logs des restaurations
- 📋 Réviser régulièrement la stratégie

## Dépannage

### Le backup échoue avec "pg_dump not found"

```bash
# Installer PostgreSQL client
sudo apt-get install postgresql-client

# Ou utiliser le client Supabase
npm install -g supabase
supabase db dump --project-id your-project-id
```

### Erreur "SUPABASE_SERVICE_KEY not found"

- Vérifier que le secret est défini dans GitHub > Settings > Secrets
- Vérifier l'orthographe exacte: `SUPABASE_SERVICE_ROLE_KEY`
- Utiliser un token valide (pas expiré)

### Le fichier de backup est trop volumineux

- Ajouter des filtres pour exclure certaines tables
- Réduire la fréquence des sauvegardes
- Archiver les sauvegardes anciennes

### Restauration très lente

- Augmenter le timeout du workflow
- Restaurer en heures creuses
- Utiliser un environnement dédié pour les tests de restauration

## Monitoring

Pour être alerté des problèmes de sauvegarde:

### Email
Configurer des notifications GitHub pour les workflows:
- Settings > Notifications > Workflow notifications

### Custom
Ajouter une étape dans le workflow pour notifier un service:

```yaml
- name: Notify Sentry
  if: failure()
  run: |
    curl -X POST "https://sentry.io/api/hooks/example/" \
      -d '{"message": "Database backup failed"}'
```

## Coûts estimés

- **GitHub Artifacts**: Gratuit pour les dépôts publics, 2GB inclus pour privé
- **S3**: ~$0.023/GB/mois pour le stockage
- **PostgreSQL backup**: Aucun coût supplémentaire (inclus dans Supabase)