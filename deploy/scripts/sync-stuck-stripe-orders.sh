#!/usr/bin/env bash
# Rattrape les commandes web PENDING_PAYMENT déjà payées sur Stripe (ancien flux).
set -euo pipefail
cd /opt/pizzeria
export COMPOSE_FILE=docker-compose.yml:deploy/docker-compose.prod.yml

echo ">>> Recherche commandes bloquées PENDING_PAYMENT + PaymentIntent…"
TOKENS=$(docker compose exec -T postgres psql -U postgres -d pizzeria_app -t -A -c \
  "SELECT \"trackingToken\" FROM \"Order\" WHERE \"isOnlineOrder\" = true AND status = 'PENDING_PAYMENT' AND \"paymentStatus\" = 'UNPAID' AND \"stripePaymentIntentId\" IS NOT NULL ORDER BY \"createdAt\" DESC LIMIT 50;")

if [ -z "$TOKENS" ]; then
  echo ">>> Aucune commande bloquée."
  exit 0
fi

SYNCED=0
while IFS= read -r token; do
  [ -z "$token" ] && continue
  echo ">>> Sync token ${token:0:8}…"
  RES=$(docker compose exec -T server wget -qO- \
    --header='Content-Type: application/json' \
    --post-data="{\"token\":\"$token\"}" \
    http://127.0.0.1:3001/api/public/payments/sync 2>/dev/null || true)
  if echo "$RES" | grep -q '"success":true'; then
    NUM=$(echo "$RES" | sed -n 's/.*"orderNumber":\([0-9]*\).*/\1/p')
    echo "    OK commande #$NUM -> CONFIRMED (cuisine + KDS)"
    SYNCED=$((SYNCED + 1))
  else
    echo "    skip: $RES"
  fi
done <<< "$TOKENS"

echo ">>> Total synchronisées: $SYNCED"
