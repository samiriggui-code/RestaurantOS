#!/usr/bin/env bash
# Corrige Atmane polyvalent + régénère la semaine — à lancer sur le VPS après deploy
set -euo pipefail
cd /opt/pizzeria
export COMPOSE_FILE=docker-compose.yml:deploy/docker-compose.prod.yml

echo ">>> Seed (shiftId null admin + meta)…"
docker compose exec -T server npx tsx prisma/seed.ts

echo ">>> Reset planning semaine courante…"
docker compose exec -T server npx tsx scripts/reset-planning-week.ts

echo ">>> OK — rafraîchir Planning (Ctrl+F5)"
