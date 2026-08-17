#!/usr/bin/env bash
# Build APK via Docker (pas besoin d'Android Studio) + copie dans public/downloads/
set -euo pipefail

cd /opt/pizzeria

OPS_HOST="${OPS_HOST:-https://pizza-app.gsms-security.com}"
PUBLIC_HOST="${PUBLIC_HOST:-https://pizza.gsms-security.com}"
OUT_DIR="app.pizzeria.fr/public/downloads"

mkdir -p "$OUT_DIR"

echo ">>> Build APK Docker (15–30 min la 1ère fois, cache ensuite)…"
echo "    OPS_HOST=$OPS_HOST"

docker build \
  -f deploy/docker/android-build.Dockerfile \
  --build-arg "OPS_HOST=${OPS_HOST}" \
  --build-arg "PUBLIC_HOST=${PUBLIC_HOST}" \
  -t pizzeria-apk-builder \
  .

cid="$(docker create pizzeria-apk-builder)"
docker cp "$cid:/dist/pos-sunmi.apk" "$OUT_DIR/pos-sunmi.apk"
docker cp "$cid:/dist/pos-tablet.apk" "$OUT_DIR/pos-tablet.apk"
docker cp "$cid:/dist/kds.apk" "$OUT_DIR/kds.apk"
docker cp "$cid:/dist/livreur.apk" "$OUT_DIR/livreur.apk"
docker rm "$cid" >/dev/null

chmod a+r "$OUT_DIR"/*.apk
ls -lh "$OUT_DIR"/*.apk

echo ">>> APK disponibles sur le CRM et :"
echo "    https://pizza-app.gsms-security.com/downloads/pos-sunmi.apk"
echo "    https://pizza-app.gsms-security.com/downloads/pos-tablet.apk"
echo "    https://pizza-app.gsms-security.com/downloads/kds.apk"
echo "    https://pizza-app.gsms-security.com/downloads/livreur.apk"
echo ">>> Rebuild conteneur web pour servir les fichiers…"
export COMPOSE_FILE=docker-compose.yml:deploy/docker-compose.prod.yml
docker compose build web
docker compose up -d web
