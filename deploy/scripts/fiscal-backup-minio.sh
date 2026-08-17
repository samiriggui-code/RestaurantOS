#!/usr/bin/env bash
# Sauvegarde PostgreSQL + archives fiscales -> MinIO (S3-compatible)
# Usage : depuis /opt/pizzeria avec .env charge (cron ou manuel)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source <(tr -d '\r' < .env)
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
CONTAINER="${DB_CONTAINER:-pizzeria-postgres}"
DB_NAME="${POSTGRES_DB:-pizzeria_app}"
DB_USER="${POSTGRES_USER:-postgres}"
TIMESTAMP="$(date +'%Y-%m-%d_%H-%M-%S')"
FILE="$BACKUP_DIR/pizzeria_${TIMESTAMP}.sql.gz"
FISCAL_DIR="${FISCAL_ARCHIVE_HOST_DIR:-$ROOT/data/fiscal-archives}"

MINIO_ALIAS="${MINIO_ALIAS:-pizzeria}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://pizzeria-minio:9000}"
MINIO_BUCKET="${MINIO_BUCKET:-pizzeria-backups}"
MINIO_ACCESS="${MINIO_ROOT_USER:-}"
MINIO_SECRET="${MINIO_ROOT_PASSWORD:-}"
MINIO_NETWORK="${MINIO_DOCKER_NETWORK:-pizzeria_pizzeria-internal}"

mkdir -p "$BACKUP_DIR"

echo "[backup] $TIMESTAMP — dump PostgreSQL ($DB_NAME)"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"
echo "[backup] SQL local : $FILE ($(du -h "$FILE" | cut -f1))"

TAR_FISCAL=""
if [[ -d "$FISCAL_DIR" ]] && [[ -n "$(ls -A "$FISCAL_DIR" 2>/dev/null || true)" ]]; then
  TAR_FISCAL="$BACKUP_DIR/fiscal_archives_${TIMESTAMP}.tar.gz"
  tar -czf "$TAR_FISCAL" -C "$(dirname "$FISCAL_DIR")" "$(basename "$FISCAL_DIR")"
  echo "[backup] Archives fiscales : $TAR_FISCAL"
fi

if [[ -z "$MINIO_ACCESS" || -z "$MINIO_SECRET" ]]; then
  echo "[backup] MinIO non configure (MINIO_ROOT_USER/PASSWORD) — backup local uniquement"
  exit 0
fi

if ! docker ps --format '{{.Names}}' | grep -q '^pizzeria-minio$'; then
  echo "[backup] Conteneur pizzeria-minio absent — backup local uniquement"
  exit 0
fi

echo "[backup] Upload MinIO ($MINIO_BUCKET)..."
docker run --rm \
  --network "$MINIO_NETWORK" \
  --entrypoint /bin/sh \
  -v "$BACKUP_DIR:/backups:ro" \
  minio/mc:latest \
  -c "
    set -e
    mc alias set local '${MINIO_ENDPOINT}' '${MINIO_ACCESS}' '${MINIO_SECRET}' --api S3v4
    mc mb --ignore-existing local/${MINIO_BUCKET}
    mc cp /backups/$(basename "$FILE") local/${MINIO_BUCKET}/postgres/
  "

if [[ -n "$TAR_FISCAL" && -f "$TAR_FISCAL" ]]; then
  docker run --rm \
    --network "$MINIO_NETWORK" \
    --entrypoint /bin/sh \
    -v "$BACKUP_DIR:/backups:ro" \
    minio/mc:latest \
    -c "
      mc alias set local '${MINIO_ENDPOINT}' '${MINIO_ACCESS}' '${MINIO_SECRET}' --api S3v4
      mc cp /backups/$(basename "$TAR_FISCAL") local/${MINIO_BUCKET}/fiscal/
    "
fi

echo "[backup] MinIO OK -> ${MINIO_BUCKET}/postgres/$(basename "$FILE")"

ls -t "$BACKUP_DIR"/pizzeria_*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
ls -t "$BACKUP_DIR"/fiscal_archives_*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
echo "[backup] Termine"
