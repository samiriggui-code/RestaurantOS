#!/usr/bin/env bash
# Installe le cron backup quotidien 04:00 Europe/Paris (dump SQL -> MinIO)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CRON_FILE="/etc/cron.d/pizzeria-backup"
LOG="/var/log/pizzeria-backup.log"

touch "$LOG"
chmod 644 "$LOG"

cat > "$CRON_FILE" <<EOF
# La Z Pizza — backup PostgreSQL + fiscal -> MinIO (04:00 Paris)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
0 4 * * * root cd ${ROOT} && bash ${ROOT}/deploy/scripts/fiscal-backup-minio.sh >> ${LOG} 2>&1
EOF

chmod 644 "$CRON_FILE"
echo "[cron] Backup installe — ${CRON_FILE} (04:00 daily, log ${LOG})"
