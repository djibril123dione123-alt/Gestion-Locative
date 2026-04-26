#!/bin/bash

# Script de sauvegarde automatique Supabase
# À adapter avec vos credentials Supabase

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-.backups}"
RETENTION_DAYS="${RETENTION_DAYS:=30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"

# Vérifier les variables d'environnement requises
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "❌ Erreur: SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis"
  exit 1
fi

# Créer le répertoire de backup s'il n'existe pas
mkdir -p "${BACKUP_DIR}"

echo "📦 Sauvegarde de la base de données Supabase..."
echo "   Destination: ${BACKUP_FILE}"

# Extraire l'ID du projet depuis l'URL
PROJECT_ID=$(echo "$SUPABASE_URL" | sed 's/.*\/\/\([^.]*\).*/\1/')

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Erreur: Impossible d'extraire l'ID du projet de SUPABASE_URL"
  exit 1
fi

# Utiliser Supabase CLI pour créer une sauvegarde
# Note: Supabase CLI doit être installé: npm install -g supabase
if command -v supabase &> /dev/null; then
  echo "✅ Supabase CLI trouvé"
  
  # Créer une sauvegarde via l'API Supabase
  # Cette commande nécessite une authentification préalable
  supabase db dump --project-id "$PROJECT_ID" > "$BACKUP_FILE" || {
    echo "⚠️  Supabase CLI dump a échoué, utilisation de pg_dump comme fallback"
    
    # Fallback: utiliser pg_dump si disponible
    if command -v pg_dump &> /dev/null; then
      # Construire la chaîne de connexion PostgreSQL
      PG_CONN="postgresql://postgres:${SUPABASE_SERVICE_KEY}@${PROJECT_ID}.db.supabase.co:5432/postgres"
      pg_dump "$PG_CONN" --no-password > "$BACKUP_FILE"
    else
      echo "❌ Ni Supabase CLI ni pg_dump n'est disponible"
      exit 1
    fi
  }
else
  echo "⚠️  Supabase CLI non trouvé, utilisation de l'API REST Supabase"
  
  # Alternative: utiliser l'API REST de Supabase
  curl -X POST "https://api.supabase.com/v1/projects/${PROJECT_ID}/backups" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"description": "Automated backup"}' \
    > "${BACKUP_DIR}/backup_info_${TIMESTAMP}.json"
  
  echo "✅ Sauvegarde créée via l'API Supabase"
fi

# Vérifier que le fichier de backup a été créé
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Erreur: Le fichier de backup n'a pas été créé"
  exit 1
fi

# Compresser le backup
gzip -f "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "✅ Sauvegarde complétée: ${BACKUP_FILE} (${FILE_SIZE})"

# Nettoyer les anciens backups
echo "🧹 Suppression des backups de plus de ${RETENTION_DAYS} jours..."
find "${BACKUP_DIR}" -name "backup_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

# Compter les backups restants
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/backup_*.sql.gz 2>/dev/null | wc -l)
echo "📊 Backups conservés: ${BACKUP_COUNT}"

echo "✅ Processus de sauvegarde terminé"
exit 0
