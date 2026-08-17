#!/usr/bin/env bash
# Restauration PostgreSQL depuis une sauvegarde gzip
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 backups/pizzeria_YYYY-MM-DD.sql.gz"
  exit 1
fi

FILE="$1"
CONTAINER="${DB_CONTAINER:-pizzeria-postgres}"
DB_NAME="${POSTGRES_DB:-pizzeria_app}"
DB_USER="${POSTGRES_USER:-postgres}"

if [[ ! -f "$FILE" ]]; then
  echo "Fichier introuvable : $FILE"
  exit 1
fi

echo "⚠️  Restauration de $DB_NAME depuis $FILE"
read -r -p "Continuer ? [y/N] " confirm
[[ "$confirm" == "y" || "$confirm" == "Y" ]] || exit 0

gunzip -c "$FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"
echo "✅ Restauration terminée"
