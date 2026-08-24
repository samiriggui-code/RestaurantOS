# Cohabitation gsms-school + La Z Pizza sur le même VPS

**VPS** : `187.77.166.124` (Hostinger)  
**gsms** : `gsms-security.com` (ou `hosting-global-it-ss.com`) — stack `/opt/gsms`  
**pizzeria** : sous-domaines dédiés — stack `/opt/pizzeria`

Les deux stacks sont **indépendantes** (Postgres, réseau Docker, conteneurs séparés). Seul **Traefik** est partagé.

---

## 1. DNS à créer (Hostinger)

Enregistrements **A** → `187.77.166.124` :

| Host                            | Usage                     |
| ------------------------------- | ------------------------- |
| `gsms-security.com`             | gsms-school (déjà fait)   |
| `pizza.gsms-security.com`       | Site public menu / panier |
| `pizza-app.gsms-security.com`   | Admin, POS, KDS           |
| `pizza-api.gsms-security.com`   | API Express               |
| `minio.pizza.gsms-security.com` | Console MinIO (backups)   |

Attendre 5–30 min de propagation avant le build.

---

## 2. Sur le VPS — gsms intact

```bash
ssh root@187.77.166.124
cd /opt/gsms   # ou chemin gsms existant
docker compose ps   # vérifier que gsms tourne toujours
```

**Ne pas** `docker compose down` sur gsms.

---

## 3. Déployer La Z Pizza

```bash
git clone <repo-restaurantos> /opt/pizzeria
cd /opt/pizzeria
cp deploy/.env.gsms-security.example .env
nano .env   # DB_PASSWORD, JWT, SMTP, SumUp (clé API sandbox)

# Réseau Traefik (déjà créé par Hostinger / gsms)
docker network ls | grep traefik

docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d

docker compose exec server npx prisma migrate deploy
docker compose exec server npx tsx prisma/seed.ts
```

---

## 4. URLs labo

| Rôle             | URL                                            |
| ---------------- | ---------------------------------------------- |
| Menu public      | https://pizza.gsms-security.com/menu           |
| Commander        | https://pizza.gsms-security.com/commander      |
| Admin CRM        | https://pizza-app.gsms-security.com/admin      |
| POS tablette     | https://pizza-app.gsms-security.com/pos        |
| KDS              | https://pizza-app.gsms-security.com/kitchen    |
| Livreur (iPhone) | https://pizza.gsms-security.com/livreur        |
| API health       | https://pizza-api.gsms-security.com/api/health |

Login seed : voir sortie `prisma/seed.ts` (admin + PIN caisse 1234).

---

## 5. Débloquer POS / KDS (IP boutique)

En prod, `/pos` et `/kitchen` sont filtrés par IP (Traefik).

1. Ouvre **https://pizza-app.gsms-security.com/admin** (depuis le Wi‑Fi du shop ou de chez toi pour le labo).
2. **Appareils** → « Utiliser l’IP de ce réseau ».
3. **Mise en service** (onboarding complete).
4. Jumeler tablette / iPhone si besoin.

Sans ça, POS/KDS restent bloqués (middleware `pizzeria-shop-ip@file`).

---

## 6. Paiement en ligne SumUp (test)

Pas de webhook signé côté SumUp : le checkout envoie son statut au `return_url` fourni à la
création (`API_PUBLIC_BASE_URL` dans `.env` → `.../api/payments/sumup-checkout/webhook`), donc
rien à configurer côté dashboard SumUp — juste s'assurer que `API_PUBLIC_BASE_URL` pointe bien
sur `https://pizza-api.gsms-security.com` avant de tester une commande en ligne.

---

## 7. Tes appareils (sans SUNMI)

| Appareil       | URL                                   | APK optionnel              |
| -------------- | ------------------------------------- | -------------------------- |
| Tablette KDS   | `pizza-app.gsms-security.com/kitchen` | `assembleKdsRelease`       |
| Tablette POS   | `pizza-app.gsms-security.com/pos`     | `assemblePosTabletRelease` |
| iPhone livreur | `pizza.gsms-security.com/livreur`     | Safari suffit              |

APK release : modifier `APP_URL` dans `android/app/build.gradle.kts` vers les URLs HTTPS ci-dessus, ou build debug avec `DEV_LAN_URL`.

---

## 8. Conflits évités

| Ressource      | gsms                 | pizzeria                   |
| -------------- | -------------------- | -------------------------- |
| Postgres       | `gsms_postgres_data` | `pizzeria_postgres_data`   |
| Port hôte 3001 | gsms-app             | non exposé (Traefik only)  |
| Traefik        | labels `gsms-*`      | labels `pizzeria-*`        |
| Hostnames      | `gsms-security.com`  | `pizza*.gsms-security.com` |

---

## 9. Rollback

```bash
cd /opt/pizzeria
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml down
# gsms non impacté
```
