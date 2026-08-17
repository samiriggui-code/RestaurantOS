#!/usr/bin/env bash
# Nettoyage Docker pizzeria — sans toucher postgres_data ni les conteneurs gsms/traefik
set -euo pipefail

echo ">>> Espace disque avant :"
df -h / | tail -1

# Archive de déploiement
rm -f /tmp/pizzeria-deploy.tar.gz 2>/dev/null || true

# Images dangling (<none>) — restes des rebuilds --no-cache
docker image prune -f

# Cache de build Docker (principal consommateur après plusieurs deploy)
docker builder prune -f

# Anciennes images pizzeria non référencées par un conteneur (running ou stopped)
if docker images --format '{{.Repository}}' | grep -qx 'pizzeria-web' || docker images --format '{{.Repository}}' | grep -qx 'pizzeria-server'; then
  while read -r id; do
    [[ -z "$id" ]] && continue
    in_use=false
    while read -r cid; do
      [[ -z "$cid" ]] && continue
      img_id="$(docker inspect --format '{{.Image}}' "$cid" 2>/dev/null || true)"
      if [[ "$img_id" == "$id" ]]; then
        in_use=true
        break
      fi
    done < <(docker ps -aq 2>/dev/null || true)
    if [[ "$in_use" == false ]]; then
      docker rmi -f "$id" 2>/dev/null || true
    fi
  done < <(docker images --filter 'reference=pizzeria-*' --format '{{.ID}}' | sort -u)
fi

echo ">>> Espace disque après :"
df -h / | tail -1
echo ">>> Images pizzeria restantes :"
docker images 'pizzeria-*' --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}' 2>/dev/null || true
