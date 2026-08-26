# Déploiement VPS — La Z Pizza / RestaurantOS

Stack cible : **PostgreSQL 16 + Express (API) + Next.js (UI)** derrière **Traefik** (Let's Encrypt).

**Guide complet** : [`docs/VPS-DEPLOIEMENT.md`](../docs/VPS-DEPLOIEMENT.md) (labo → client, SumUp, SMTP, Sentry, WhatsApp, devices).

**VPS labo partagé avec un autre projet** : ce VPS héberge une autre stack indépendante à côté de celle-ci (Postgres/Docker/réseau séparés, seul Traefik est commun) — voir template d'env dédié [`deploy/.env.gsms-security.example`](.env.gsms-security.example) pour les variables spécifiques à cet environnement de labo.

## Prérequis VPS

- Docker + Docker Compose v2
- Traefik déjà installé sur le VPS (réseau Docker externe `traefik`)
- DNS :
  - `pizzeria.fr` → VPS
  - `app.pizzeria.fr` → VPS
  - `api.pizzeria.fr` → VPS

## Installation

```bash
git clone <repo> /opt/pizzeria
cd /opt/pizzeria
cp deploy/.env.production.example .env
# Éditer .env : DB_PASSWORD, JWT_SECRET, SUMUP_*, BUSINESS_ID
docker compose pull
docker compose build
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d
docker compose exec server npx prisma migrate deploy
```

## Variables essentielles

| Variable                                | Exemple                                                      |
| --------------------------------------- | ------------------------------------------------------------ |
| `DB_PASSWORD`                           | mot de passe fort PostgreSQL                                 |
| `JWT_SECRET` / `REFRESH_SECRET`         | `openssl rand -base64 32`                                    |
| `NEXT_PUBLIC_API_URL`                   | `https://api.pizzeria.fr/api`                                |
| `PUBLIC_SITE_URL`                       | `https://pizzeria.fr` (QR reçus)                             |
| `FRONTEND_URL`                          | `https://pizzeria.fr,https://app.pizzeria.fr`                |
| `SUMUP_API_KEY` / `SUMUP_MERCHANT_CODE` | clés SumUp (comptoir + paiement en ligne)                    |
| `API_PUBLIC_BASE_URL`                   | URL publique de l'API (callback checkout SumUp)              |
| `BUSINESS_ID`                           | UUID du seed Prisma                                          |
| `RESTAURANT_ALLOWED_IPS`                | _(déprécié)_ — préférer sync CRM → `deploy/traefik/dynamic/` |

## Filtrage IP — POS / KDS (restaurant uniquement)

`/pos` et `/kitchen` sur `app.pizzeria.fr` sont **bloqués hors IP du restaurant** (middleware Traefik `pizzeria-shop-ip@file`).

**Sync automatique** : CRM → Appareils → « Utiliser l’IP de ce réseau » écrit `deploy/traefik/dynamic/pizzeria-shop-ip.yml` (volume Docker `server`).

**Traefik externe** doit charger ce dossier :

```bash
--providers.file.directory=/opt/pizzeria/deploy/traefik/dynamic
--providers.file.watch=true
```

**Manuel** (secours) :

```bash
node deploy/scripts/sync-traefik-shop-ip.mjs 203.0.113.42/32
# ou depuis la BDD :
node deploy/scripts/sync-traefik-shop-ip.mjs --from-api
```

## Sauvegardes

Sauvegarde quotidienne (cron root) :

```bash
0 3 * * * /opt/pizzeria/deploy/scripts/backup-vps.sh >> /var/log/pizzeria-backup.log 2>&1
```

Copie chiffrée hors VPS (ex. rsync + gpg vers stockage externe) — voir `deploy/scripts/backup-vps.sh`.

Restauration test :

```bash
./deploy/scripts/restore-vps.sh backups/pizzeria_YYYY-MM-DD.sql.gz
```

## Recette post-déploiement (CDC §9)

1. Commande en ligne payée → ticket cuisine + reçu sur SUNMI V2
2. Commande comptoir → tickets + QR suivi `/suivi/:token`
3. Coupure réseau POS (WebView APK résidente) → file IndexedDB + sync
4. WebView SUNMI ≥ 64 — voir `docs/webview-sunmi-checklist.md`

## Dev local (sans Docker)

```bash
npm run dev          # Next.js :3000 + API :3001
npm run dev:mobile   # HTTPS pour GPS livreur sur téléphone
```

## Legacy

Le dossier `client/` (Vite) n'est **plus** inclus dans le build Docker ni la CI.
