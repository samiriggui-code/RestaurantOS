#!/usr/bin/env bash
# Sauvegarde PostgreSQL quotidienne — VPS production
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
CONTAINER="${DB_CONTAINER:-pizzeria-postgres}"
DB_NAME="${POSTGRES_DB:-pizzeria_app}"
DB_USER="${POSTGRES_USER:-postgres}"
TIMESTAMP="$(date +'%Y-%m-%d_%H-%M-%S')"
FILE="$BACKUP_DIR/pizzeria_${TIMESTAMP}.sql.gz"
RETENTION="${RETENTION_COUNT:-14}"
GPG_RECIPIENT="${BACKUP_GPG_RECIPIENT:-}"

mkdir -p "$BACKUP_DIR"

echo "[backup] $TIMESTAMP — $DB_NAME"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"

if [[ -n "$GPG_RECIPIENT" ]]; then
  gpg --encrypt --recipient "$GPG_RECIPIENT" --output "${FILE}.gpg" "$FILE"
  rm -f "$FILE"
  echo "[backup] Chiffré : ${FILE}.gpg"
else
  echo "[backup] Fichier : $FILE"
fi

ls -t "$BACKUP_DIR"/pizzeria_*.sql.gz 2>/dev/null | tail -n +$((RETENTION + 1)) | xargs -r rm -f
ls -t "$BACKUP_DIR"/pizzeria_*.sql.gz.gpg 2>/dev/null | tail -n +$((RETENTION + 1)) | xargs -r rm -f

echo "[backup] OK"
