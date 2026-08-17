#!/usr/bin/env bash
# Corrige .env Stripe sur /opt/pizzeria, supprime le dossier doublon Windows (CRLF), redémarre l'API.
set -euo pipefail

DEPLOY_DIR="/opt/pizzeria"
cd "$DEPLOY_DIR"

echo ">>> Dossiers pizza dans /opt :"
find /opt -maxdepth 1 -type d -name 'piz*' -print | while read -r d; do
  printf '  %q' "$d"
  if [[ -f "$d/.env" ]]; then
    echo " (.env $(wc -c < "$d/.env") octets)"
  else
    echo " (pas de .env)"
  fi
done

# Supprimer le doublon créé par CRLF Windows (nom se termine par \r)
while IFS= read -r -d '' bad; do
  base="$(basename "$bad")"
  if [[ "$base" == $'pizzeria\r' ]] || [[ "$base" == *$'\r' ]]; then
    echo ">>> Suppression dossier fantôme : $(printf %q "$bad")"
    rm -rf "$bad"
  fi
done < <(find /opt -maxdepth 1 -type d -name 'piz*' -print0)

ENV_FILE="$DEPLOY_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERREUR: $ENV_FILE introuvable — le stack tourne depuis $DEPLOY_DIR"
  exit 1
fi

# Normaliser guillemets autour des valeurs Stripe (docker + SDK Stripe)
strip_quotes() {
  local v="$1"
  v="${v#\"}"; v="${v%\"}"
  v="${v#\'}"; v="${v%\'}"
  printf '%s' "$v"
}

upsert_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

if [[ -f "$ENV_FILE" ]]; then
  # Lire clés existantes et retirer guillemets
  pub="$(grep '^NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
  sec="$(grep '^STRIPE_SECRET_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
  wh="$(grep '^STRIPE_WEBHOOK_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
  prod="$(grep '^STRIPE_PIZZERIA_PRODUCT_ID=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"

  pub="$(strip_quotes "$pub")"
  sec="$(strip_quotes "$sec")"
  wh="$(strip_quotes "$wh")"
  prod="$(strip_quotes "$prod")"

  [[ -n "$pub" ]] && upsert_env "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" "$pub"
  [[ -n "$sec" ]] && upsert_env "STRIPE_SECRET_KEY" "$sec"
  [[ -n "$wh" ]] && upsert_env "STRIPE_WEBHOOK_SECRET" "$wh"
  [[ -n "$prod" ]] && upsert_env "STRIPE_PIZZERIA_PRODUCT_ID" "$prod"
  # Alias serveur Express (create-intent)
  [[ -n "$pub" ]] && upsert_env "STRIPE_PUBLISHABLE_KEY" "$pub"
fi

# Proxy interne Next → Express (manquant dans certains .env labo)
if ! grep -q '^API_URL=' "$ENV_FILE" 2>/dev/null; then
  echo 'API_URL=http://server:3001' >> "$ENV_FILE"
fi

echo ">>> Variables Stripe présentes (longueurs uniquement) :"
grep -E '^(STRIPE_|NEXT_PUBLIC_STRIPE)' "$ENV_FILE" | while IFS='=' read -r k v; do
  v="$(strip_quotes "$v")"
  echo "  $k len=${#v}"
done

export COMPOSE_FILE=docker-compose.yml:deploy/docker-compose.prod.yml

echo ">>> Recréation conteneur API (recharge .env)…"
docker compose up -d --force-recreate server

echo ">>> Vérification conteneur (longueurs) :"
docker exec pizzeria-api sh -c 'echo STRIPE_SECRET_KEY_len=${#STRIPE_SECRET_KEY}; echo NEXT_PUBLIC_STRIPE_len=${#NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}; echo STRIPE_PUBLISHABLE_KEY_len=${#STRIPE_PUBLISHABLE_KEY}'

echo ">>> Nettoyage images Docker orphelines…"
chmod +x deploy/scripts/vps-docker-clean.sh
./deploy/scripts/vps-docker-clean.sh

echo ">>> OK — stack : $DEPLOY_DIR"
