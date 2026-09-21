# Guide de déploiement final chez le client — La Z Pizza / RestaurantOS

> **Runbook opérationnel** : de la préparation en labo jusqu'à la remise des clés au gérant.
> Conforme au **CDC v2.4** (juillet 2026) : tablettes standard + 2 imprimantes Epson ePOS — **plus de matériel SUNMI**.
> Docs de référence : [`VPS-DEPLOIEMENT.md`](VPS-DEPLOIEMENT.md) · [`../deploy/README.md`](../deploy/README.md) · [`../deploy/FISCAL-OPS.md`](../deploy/FISCAL-OPS.md) · [`checklist-remise-client-fiscal.md`](checklist-remise-client-fiscal.md)

---

## 0. Périmètre v2.4 (rappel)

| Élément         | Solution livrée                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Site public     | `pizzeria.fr` — menu, commande en ligne, Stripe, suivi                                                          |
| Caisse (POS)    | **APK WebView `posTablet`** sur tablette comptoir standard                                                      |
| Cuisine (KDS)   | **APK WebView `kds`** sur tablette cuisine                                                                      |
| Livreur         | **APK WebView `livreur`** sur smartphone                                                                        |
| Impression      | **Epson comptoir** (reçus) + **Epson cuisine** (tickets préparation), ePOS-Print / ESC-POS sur le LAN           |
| Registre fiscal | API vers caisse certifiée (type Zelty) — module E ; option de repli ISCA en propre **conservée** au CDC §2bis.4 |
| Back-office     | `app.pizzeria.fr/admin` (accessible Internet, login staff)                                                      |

**Règles métier actées (07/2026)** :

- **Livraison uniquement prépayée en ligne** (Stripe). Le livreur n'encaisse jamais ; pas de création de commande livraison au comptoir en V1.
- POS/KDS accessibles **uniquement depuis l'IP publique du restaurant** (middleware Traefik `pizzeria-shop-ip@file`).

---

## 1. J-7 — Préparation avant la visite

### 1.1 Infrastructure

- [ ] **VPS client** provisionné (ou VPS mutualisé avec hostnames dédiés) : Docker + Compose v2, Traefik externe avec Let's Encrypt (réseau Docker `traefik`)
- [ ] **DNS** chez le registrar :
  ```
  pizzeria.fr          A → IP_VPS
  app.pizzeria.fr      A → IP_VPS
  api.pizzeria.fr      A → IP_VPS
  ```
- [ ] Traefik externe charge le dossier dynamique (filtrage IP shop) :
  ```
  --providers.file.directory=/opt/pizzeria/deploy/traefik/dynamic
  --providers.file.watch=true
  ```

### 1.2 Comptes tiers (au nom du client)

- [ ] **Stripe LIVE** : compte du client activé, clés `sk_live_…` / `pk_live_…`
- [ ] **SMTP** prod (ex. Hostinger) : boîte `commandes@pizzeria.fr` créée
- [ ] **Sentry** (optionnel) : projet créé, DSN API + DSN front
- [ ] **Twilio / WhatsApp** (optionnel V1) : sinon laisser `SMS_PROVIDER` vide (stub console)

### 1.3 Matériel à réceptionner / vérifier

- [ ] 1 tablette comptoir (caisse) + 1 tablette cuisine (KDS) — Android 7.1+, WebView Chrome ≥ 64
- [ ] 2 imprimantes **Epson** (comptoir + cuisine) — prévoir **IP LAN fixes** (réservation DHCP sur la box du shop)
- [ ] Smartphone livreur (APK `livreur`, GPS activé)
- [ ] TPE bancaire du client (indépendant — aucun lien informatique avec la caisse ; montant saisi à la main, référence TPE **obligatoire** dans la caisse)

### 1.4 `.env` production

- [ ] Copier le template : `cp deploy/.env.production.example .env` (à la racine, sur le VPS)
- [ ] Renseigner — **secrets neufs, jamais ceux du labo** :

| Variable                                                     | Valeur prod                                            | Note                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `DB_PASSWORD`                                                | fort, généré                                           |                                                                         |
| `JWT_SECRET` / `REFRESH_SECRET`                              | `openssl rand -base64 32` chacun                       | Nouveaux                                                                |
| `FISCAL_HMAC_SECRET`                                         | généré, **distinct** de `JWT_SECRET`                   | ⚠️ **Ne jamais changer après mise en service** (rupture chaîne fiscale) |
| `FISCAL_SOFTWARE_VERSION`                                    | version livrée                                         |                                                                         |
| `FISCAL_ALLOW_JET_REPAIR`                                    | `false`                                                | `true` = labo uniquement                                                |
| `FISCAL_REQUIRE_PRECLOSE`                                    | `true`                                                 |                                                                         |
| `BUSINESS_ID`                                                | UUID du seed Prisma client                             |                                                                         |
| `PUBLIC_HOST` / `OPS_HOST` / `API_HOST`                      | `pizzeria.fr` / `app.pizzeria.fr` / `api.pizzeria.fr`  |                                                                         |
| `NEXT_PUBLIC_API_URL`                                        | `https://api.pizzeria.fr/api`                          |                                                                         |
| `PUBLIC_SITE_URL`                                            | `https://pizzeria.fr`                                  | QR reçus                                                                |
| `FRONTEND_URL`                                               | `https://pizzeria.fr,https://app.pizzeria.fr`          |                                                                         |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`   | `sk_live_…` / `pk_live_…`                              | Compte **client**                                                       |
| `STRIPE_WEBHOOK_SECRET`                                      | depuis Dashboard live (§3)                             |                                                                         |
| `EMAIL_SERVER_*` / `EMAIL_FROM` / `ADMIN_NOTIFICATION_EMAIL` | SMTP client                                            | Reçus fiscaux web                                                       |
| `ENABLED_MODULES`                                            | `menu,pos,kiosk,kitchen,orders,reports,users,settings` | V1 La Z Pizza (pas de salle)                                            |
| `DRIVER_ACCESS_PIN`                                          | **nouveau PIN**                                        | Voir §7 sécurité                                                        |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`                      | DSN prod                                               | Optionnel                                                               |

- [ ] Aucun secret committé ; `.env` uniquement sur le VPS.

### 1.5 Base de données

- [ ] Seed préparé avec **le menu réel du client** (catégories, produits, prix TTC, TVA)
- [ ] **Aucune** commande/donnée de test du labo dans la BDD livrée

---

## 2. Déploiement sur le VPS

```bash
git clone <repo> /opt/pizzeria
cd /opt/pizzeria
cp deploy/.env.production.example .env   # puis éditer (§1.4)

docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml build
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d
docker compose exec server npx prisma migrate deploy
docker compose exec server npx tsx prisma/seed.ts   # seed menu client
```

Vérifications immédiates :

- [ ] `https://pizzeria.fr` répond en HTTPS (certificat Let's Encrypt valide)
- [ ] `https://app.pizzeria.fr/admin` → page de login
- [ ] `https://api.pizzeria.fr/api/health` (ou route équivalente) OK
- [ ] `/pos` et `/kitchen` **bloqués** depuis l'extérieur (onboarding non fait + filtre IP)

---

## 3. Stripe LIVE

1. [ ] Dashboard Stripe (compte client) → Webhooks → endpoint `https://api.pizzeria.fr/api/payments/webhook`
2. [ ] Événements : ceux du flux commande (payment_intent / checkout selon config actuelle)
3. [ ] Copier `whsec_…` → `.env` (`STRIPE_WEBHOOK_SECRET`) → `docker compose up -d server`
4. [ ] Build Next avec `pk_live_…` (arg de build — rebuild `web` si la clé a changé)
5. [ ] **Aucune clé `sk_test`/`pk_test` restante** dans `.env`, les builds, ou la BDD

---

## 4. APK — build & installation

Build (poste dev, JDK 17) :

```bash
cd android
./gradlew assemblePosTabletRelease assembleKdsRelease assembleLivreurRelease
# URLs par défaut : app.pizzeria.fr / pizzeria.fr — sinon surcharger :
#   -POPS_HOST=https://app.pizzeria.fr -PPUBLIC_HOST=https://pizzeria.fr
```

APK produits : `android/app/build/outputs/apk/<flavor>/release/`

Installation (ADB ou copie du fichier) :

- [ ] Tablette comptoir ← `posTablet` (ouvre `/pos`)
- [ ] Tablette cuisine ← `kds` (ouvre `/kitchen`)
- [ ] Smartphone livreur ← `livreur` (ouvre `/livreur`)

Rappels APK : navigation verrouillée sur le host autorisé (`ALLOWED_HOST`), file hors-ligne IndexedDB + resync, impression Epson via `window.EpsonPrinter.printToLan(ip, texte, …)` (port 9100).

---

## 5. Jour J — Mise en service sur place

> Ton portable connecté au **Wi-Fi du restaurant** (nécessaire pour capter l'IP WAN du shop).

### 5.1 Onboarding devices (CRM `/admin/devices`)

1. [ ] Login admin sur `app.pizzeria.fr/admin`
2. [ ] Appareils → **« Utiliser l'IP de ce réseau »** → écrit l'IP WAN dans `deploy/traefik/dynamic/pizzeria-shop-ip.yml` (sync auto ; secours : `node deploy/scripts/sync-traefik-shop-ip.mjs --from-api`)
3. [ ] **Jumeler** tablette caisse et tablette cuisine (code 6 chiffres affiché au premier lancement de l'APK)
4. [ ] Saisir les **IP LAN des 2 Epson** (comptoir + cuisine) dans le CRM
5. [ ] **Test d'impression** sur chaque binôme (caisse→Epson comptoir, KDS→Epson cuisine)

### 5.2 Fiscal ISCA (voir [`../deploy/FISCAL-OPS.md`](../deploy/FISCAL-OPS.md))

1. [ ] Admin → Paramètres → Établissement : **SIRET, TVA, raison sociale** (mentions ticket 58 mm)
2. [ ] **Date de mise en service ISCA** = premier service réel
3. [ ] **Mode formation : OFF**
4. [ ] Fiscal ISCA → **Contrôle chaîne** vert (`npm run fiscal:verify-chain --prefix server` côté technique)
5. [ ] Ne **pas** clôturer les journées antérieures (tests labo / ancien logiciel)

### 5.3 Recette fonctionnelle ([`smoke-checklist-pizzeria-v1.md`](smoke-checklist-pizzeria-v1.md))

- [ ] Commande **web payée** (paiement réel minimal possible) → webhook → KDS temps réel → ticket cuisine imprimé → reçu + QR suivi
- [ ] Commande **comptoir** (caisse) → ticket fiscal synchrone + ticket cuisine
- [ ] Avancement statuts KDS : PREPARING → READY → OUT_FOR_DELIVERY → app livreur (code client 4 chiffres)
- [ ] Suivi client `pizzeria.fr/suivi/:token` OK
- [ ] **Coupure Wi-Fi** sur la tablette caisse → file hors-ligne → resync à la reconnexion
- [ ] Email de confirmation reçu (SMTP prod)
- [ ] Depuis la **4G** (hors Wi-Fi shop) : `/pos` et `/kitchen` **inaccessibles**, `/admin` accessible
- [ ] Purger/rembourser la commande test ; fin du premier service réel → **Pré-clôture & Z**

### 5.4 Mise en service

- [ ] CRM → **« Mise en service »** (`onboardingComplete`) — admin uniquement

---

## 6. Sauvegardes & supervision

- [ ] Cron backup quotidien (root VPS) :
  ```
  0 3 * * * /opt/pizzeria/deploy/scripts/backup-vps.sh >> /var/log/pizzeria-backup.log 2>&1
  ```
- [ ] Copie hors-VPS : MinIO (`deploy/docker-compose.ops.yml` + `deploy/scripts/fiscal-backup-minio.sh`) — rétention 14 j local / 90 j MinIO
- [ ] **Test de restauration** effectué au moins une fois : `./deploy/scripts/restore-vps.sh backups/pizzeria_YYYY-MM-DD.sql.gz`
- [ ] En cas de redeploy : restaurer dump **et** archives fiscales ; **ne jamais réinitialiser** `FISCAL_HMAC_SECRET`
- [ ] Sentry : une erreur test remonte bien (API + front)

---

## 7. Sécurité — à verrouiller AVANT la remise

- [ ] ⚠️ **Changer tous les PIN utilisés en labo** — les PIN `2580` (équipe), `3456` (livreur), `2468` (admin) ont été **affichés publiquement** sur la page `/livreur` de l'environnement labo (constat audit SEO 07/2026) : ils sont grillés.
- [ ] **Retirer l'affichage des PIN** sur la page `/livreur` (aide de connexion) — aucune page publique ne doit lister un PIN
- [ ] `DRIVER_ACCESS_PIN` prod ≠ labo ; PIN caisse/cuisine/admin propres au client
- [ ] Mot de passe admin CRM fort, remis au gérant en main propre (pas par email)
- [ ] Secrets labo absents du VPS client (Stripe test, SMTP test, Sentry dev)
- [ ] `FISCAL_ALLOW_JET_REPAIR=false` confirmé

### Site public (recommandé avant ouverture au référencement)

- [ ] `robots.txt` + `sitemap.xml` présents (constat audit : absents sur le labo) ; disallow `/livreur`, `/commander`, `/pos`, `/kitchen`, `/admin`
- [ ] `og:image` + canonicals + metadata uniques par page
- [ ] Fiche **Google Business Profile** créée et reliée à `pizzeria.fr`

---

## 8. Remise au client

### Documents & accès

- [ ] Compte **admin CRM** (identifiants) + PIN caisse / cuisine / livreur (nouveaux)
- [ ] Doc client [`architecture-materiel-client.md`](architecture-materiel-client.md) (« comment tout communique »)
- [ ] Doc courte incidents : coupure électricité, papier imprimante, perte Wi-Fi
- [ ] Guide gérant fiscal **in-app** (`/admin/fiscal`) présenté

### Formation gérant (sur place)

- [ ] Prise de commande caisse + encaissement (référence TPE manuelle obligatoire)
- [ ] KDS : statuts, renvoi ticket
- [ ] **Clôture Z chaque soir de service** (rappel auto 23h55)
- [ ] Annulation = **avoir automatique** (jamais de suppression)
- [ ] Modifier menu / prix / horaires dans l'admin
- [ ] Export archive fiscale en fin d'exercice

### Juridique / fiscal (avec l'expert-comptable du client)

- [ ] Revue [`conformite-article-286-cgi.md`](conformite-article-286-cgi.md)
- [ ] Signature [`attestation-logiciel-caisse-bofip.md`](attestation-logiciel-caisse-bofip.md) — la LF 2026 (n° 2026-103, art. 125) **rétablit l'attestation individuelle de l'éditeur** comme preuve de conformité, à côté du certificat NF525/LNE
- [ ] Dossier conservé **6 ans** (tickets + JET + clôtures + archives)
- [ ] Formulation : « conformité ISCA (art. 286 CGI) » — **ne jamais dire « certifié NF525 »** sans certificat officiel

---

## 9. Après la livraison

| Situation                                    | Procédure                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Tablette / imprimante HS                     | CRM → Appareils → dissocier → jumeler la nouvelle → re-test impression                     |
| Changement de box Internet (nouvelle IP WAN) | Sur place : « Utiliser l'IP de ce réseau » (ou `sync-traefik-shop-ip.mjs`)                 |
| Mise à jour logiciel                         | `git pull` → rebuild → `up -d` → `prisma migrate deploy` → vérifier contrôle chaîne fiscal |
| Restauration après incident                  | `restore-vps.sh` + archives fiscales ; même `FISCAL_HMAC_SECRET`                           |
| Commandes Stripe bloquées                    | `deploy/scripts/sync-stuck-stripe-orders.sh`                                               |
| 2ᵉ boutique                                  | Nouveau VPS + nouveau `.env` (1 déploiement = 1 boutique)                                  |

---

## 10. Checklist finale « GO »

- [ ] FQDN + SSL OK (3 hosts)
- [ ] Stripe **live** + webhook testé en réel
- [ ] SMTP : email de commande reçu
- [ ] Onboarding devices terminé + IP WAN enregistrée
- [ ] 2 Epson configurées, tests d'impression OK
- [ ] Recette smoke complète passée, commande test purgée
- [ ] Fiscal : date de mise en service fixée, formation OFF, chaîne verte, premier Z prévu
- [ ] Sauvegardes cron actives + restauration testée
- [ ] Tous les PIN et secrets renouvelés (rien du labo)
- [ ] Attestation BOFiP signée / en cours avec l'expert-comptable
- [ ] Documents remis + formation gérant faite

---

_Créé le 15/07/2026 — synthèse de `VPS-DEPLOIEMENT.md`, `deploy/README.md`, `deploy/FISCAL-OPS.md`, `checklist-remise-client-fiscal.md`, `android/README.md` et de l'audit SEO/sécurité du labo (07/2026), aligné CDC v2.4._
