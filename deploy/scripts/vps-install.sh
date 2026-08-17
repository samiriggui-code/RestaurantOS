#!/usr/bin/env bash
# Exécuter sur le VPS après extraction du tar dans /opt/pizzeria
set -euo pipefail

cd /opt/pizzeria

# Corriger CRLF Windows dans .env (évite erreurs source / cron)
if [[ -f .env ]] && grep -q $'\r' .env 2>/dev/null; then
  sed -i 's/\r$//' .env
  echo ">>> .env — fins de ligne CRLF corrigées"
fi

# Dossier fantôme Windows (pizzeria + CR) créé par tar CRLF — supprimer
while IFS= read -r -d '' bad; do
  echo ">>> Suppression dossier fantôme : $(printf %q "$bad")"
  rm -rf "$bad"
done < <(find /opt -maxdepth 1 -type d -name '*pizzeria*' -print0 2>/dev/null | while IFS= read -r -d '' d; do
  [[ "$(basename "$d")" == *$'\r' ]] && printf '%s\0' "$d"
done)

if [[ ! -f .env ]]; then
  cp deploy/.env.gsms-security.example .env
  DB_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
  JWT="$(openssl rand -base64 32)"
  REF="$(openssl rand -base64 32)"
  FISCAL="$(openssl rand -base64 32)"
  sed -i "s|DB_PASSWORD=CHANGE_ME_STRONG|DB_PASSWORD=${DB_PASS}|" .env
  sed -i "s|JWT_SECRET=CHANGE_ME_openssl_rand_base64_32|JWT_SECRET=${JWT}|" .env
  sed -i "s|REFRESH_SECRET=CHANGE_ME_openssl_rand_base64_32|REFRESH_SECRET=${REF}|" .env
  sed -i "s|FISCAL_HMAC_SECRET=CHANGE_ME_openssl_rand_base64_32|FISCAL_HMAC_SECRET=${FISCAL}|" .env
  echo ">>> .env créé — édite EMAIL_SERVER_PASSWORD et STRIPE_* puis relance ce script"
  exit 0
fi

# Labo gsms : auto-enregistrement IP boutique au jumelage (idempotent)
if ! grep -q '^DEVICE_AUTO_WAN_IP=' .env 2>/dev/null; then
  echo 'DEVICE_AUTO_WAN_IP=true' >> .env
fi
if ! grep -q '^FISCAL_ALLOW_JET_REPAIR=' .env 2>/dev/null; then
  echo 'FISCAL_ALLOW_JET_REPAIR=true' >> .env
fi
if ! grep -q '^FISCAL_REQUIRE_PRECLOSE=' .env 2>/dev/null; then
  echo 'FISCAL_REQUIRE_PRECLOSE=true' >> .env
fi
if [[ "${FORCE_FISCAL_LAB_RESET:-0}" == "1" ]]; then
  sed -i 's/^FISCAL_LAB_RESET=.*/FISCAL_LAB_RESET=true/' .env 2>/dev/null || echo 'FISCAL_LAB_RESET=true' >> .env
  echo ">>> FORCE_FISCAL_LAB_RESET=1 — reset fiscal activé pour ce deploy"
fi
if ! grep -q '^FISCAL_LAB_RESET=' .env 2>/dev/null; then
  echo 'FISCAL_LAB_RESET=false' >> .env
fi

# MinIO — coffre-fort backups (labo gsms activé par défaut)
if ! grep -q '^MINIO_ENABLED=' .env 2>/dev/null; then
  echo 'MINIO_ENABLED=true' >> .env
fi
if grep -q 'MINIO_ENABLED=true' .env 2>/dev/null; then
  if ! grep -q '^MINIO_ROOT_USER=' .env 2>/dev/null; then
    echo 'MINIO_ROOT_USER=pizzeria_minio' >> .env
  fi
  if ! grep -q '^MINIO_ROOT_PASSWORD=' .env 2>/dev/null || grep -q 'MINIO_ROOT_PASSWORD=CHANGE_ME' .env 2>/dev/null; then
    MINIO_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
    if grep -q '^MINIO_ROOT_PASSWORD=' .env 2>/dev/null; then
      sed -i "s|^MINIO_ROOT_PASSWORD=.*|MINIO_ROOT_PASSWORD=${MINIO_PASS}|" .env
    else
      echo "MINIO_ROOT_PASSWORD=${MINIO_PASS}" >> .env
    fi
    echo ">>> MinIO : mot de passe généré (voir MINIO_ROOT_PASSWORD dans .env)"
  fi
  if ! grep -q '^MINIO_CONSOLE_HOST=' .env 2>/dev/null; then
    echo 'MINIO_CONSOLE_HOST=minio.pizza.gsms-security.com' >> .env
  fi
  if ! grep -q '^MINIO_BUCKET=' .env 2>/dev/null; then
    echo 'MINIO_BUCKET=pizzeria-backups' >> .env
  fi
  if ! grep -q '^MINIO_ENDPOINT=' .env 2>/dev/null; then
    echo 'MINIO_ENDPOINT=http://pizzeria-minio:9000' >> .env
  fi
  if ! grep -q '^BACKUP_DIR=' .env 2>/dev/null; then
    echo 'BACKUP_DIR=/app/backups' >> .env
  fi
  if ! grep -q '^FISCAL_ARCHIVE_DIR=' .env 2>/dev/null; then
    echo 'FISCAL_ARCHIVE_DIR=/app/data/fiscal-archives' >> .env
  fi
  if ! grep -q '^MINIO_DEV_CONSOLE=' .env 2>/dev/null; then
    echo 'MINIO_DEV_CONSOLE=true' >> .env
  fi
fi

# Réseau Docker partagé avec Traefik (déjà présent sur le VPS gsms)
docker network inspect gsms >/dev/null 2>&1 || { echo "Réseau gsms introuvable — créer la stack Traefik d'abord"; exit 1; }

export COMPOSE_FILE=docker-compose.yml:deploy/docker-compose.prod.yml
if grep -q 'MINIO_ENABLED=true' .env 2>/dev/null; then
  export COMPOSE_FILE="${COMPOSE_FILE}:deploy/docker-compose.ops.yml"
  echo ">>> Stack ops MinIO incluse dans COMPOSE_FILE"
fi

mkdir -p deploy/traefik/dynamic backups data/fiscal-archives
chmod a+rwx deploy/traefik/dynamic backups data/fiscal-archives 2>/dev/null || true
# Middleware IP shop — dossier Traefik partagé VPS (si présent)
if [ -d /opt/traefik/dynamic ]; then
  cp -f deploy/traefik/dynamic/pizzeria-shop-ip.yml /opt/traefik/dynamic/pizzeria-shop-ip.yml 2>/dev/null || true
fi

echo ">>> Nettoyage Docker avant build…"
chmod +x deploy/scripts/vps-docker-clean.sh
./deploy/scripts/vps-docker-clean.sh

echo ">>> Build images…"
if [[ "${PIZZERIA_FORCE_REBUILD:-0}" == "1" ]]; then
  echo "    (rebuild complet sans cache — PIZZERIA_FORCE_REBUILD=1)"
  docker compose build --no-cache
else
  docker compose build
fi

echo ">>> Démarrage stack…"
docker compose up -d --remove-orphans

echo ">>> Nettoyage images orphelines après deploy…"
docker image prune -f
docker builder prune -f
rm -f /tmp/pizzeria-deploy.tar.gz 2>/dev/null || true

echo ">>> Migrations + seed…"
docker compose exec -T server npx prisma migrate deploy
docker compose exec -T server npx tsx prisma/seed.ts || true

echo ">>> Planning semaine (gérant polyvalent + couverture équipe)…"
docker compose exec -T server npx tsx scripts/reset-planning-week.ts || true

if grep -q 'FISCAL_LAB_RESET=true' .env 2>/dev/null; then
  echo ">>> Reset labo fiscal (conserve clôtures Z, efface commandes/tickets)…"
  docker compose exec -T server npx tsx scripts/fiscal-lab-reset.ts || true
  sed -i 's/^FISCAL_LAB_RESET=true/FISCAL_LAB_RESET=false/' .env
fi

echo ">>> Réparation chaîne JET (labo — horodatage legacy)…"
docker compose exec -T server npx tsx scripts/fiscal-repair-jet-chain.ts || true

if grep -q 'MINIO_ENABLED=true' .env 2>/dev/null; then
  echo ">>> MinIO — démarrage + init bucket…"
  docker compose up -d minio
  sleep 5
  docker compose run --rm minio-init || true
  chmod +x deploy/scripts/fiscal-backup-minio.sh deploy/scripts/install-backup-cron.sh
  echo ">>> MinIO — backup test…"
  bash deploy/scripts/fiscal-backup-minio.sh || true
  bash deploy/scripts/install-backup-cron.sh || true
  set -a
  # shellcheck disable=SC1091
  source <(tr -d '\r' < .env)
  set +a
  echo ""
  echo "MinIO console : https://${MINIO_CONSOLE_HOST:-minio.pizza.gsms-security.com}"
  echo "  Login : ${MINIO_ROOT_USER:-pizzeria_minio}"
  echo "  Pass  : (voir MINIO_ROOT_PASSWORD dans /opt/pizzeria/.env)"
  echo "  Bucket : ${MINIO_BUCKET:-pizzeria-backups}/postgres/"
fi

echo ">>> Conteneurs :"
docker compose ps

echo ""
echo "URLs labo :"
echo "  https://pizza.gsms-security.com/menu"
echo "  https://pizza-app.gsms-security.com/admin"
echo "  https://pizza-api.gsms-security.com/api/health"
