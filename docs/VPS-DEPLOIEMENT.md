# VPS & déploiement — RestaurantOS / La Z Pizza

Guide de référence : **développement sur ton VPS labo** → **livraison chez le client** (même stack, autre `.env`, autres devices).

Références infra existantes :

- Projet **gsms-school** : `c:\laragon\www\gsms-school\deploy\gsms\.env` (Traefik externe Hostinger, SMTP Hostinger)
- Projet **RestaurantOS** : `deploy/docker-compose.prod.yml`, `deploy/.env.production.example`
- CDC : `cahier-des-charges-pizzeria-v2.md`

---

## 1. Résumé de ce qu’on a défini

### Architecture produit

| Couche          | Rôle                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| **VPS cloud**   | PostgreSQL + API Express + Next.js (cerveau unique)                                                       |
| **Site public** | `pizzeria.fr` — menu, panier, paiement en ligne SumUp, suivi                                              |
| **CRM admin**   | `app.pizzeria.fr/admin` — accessible Internet (login staff)                                               |
| **POS / KDS**   | `app.pizzeria.fr/pos`, `/kitchen` — **bloqués** jusqu’au paramétrage CRM, puis **IP boutique** uniquement |
| **Livreur**     | `pizzeria.fr/livreur` — Internet (APK WebView sur téléphone perso)                                        |
| **Android**     | APK WebView (SUNMI, tablette POS, KDS, livreur) — ponts natifs impression/TPE sur SUNMI                   |

### Modèle commercial (type Tabesto, pas SaaS multi-tenant)

- **1 déploiement = 1 boutique** (VPS + `.env` dédié).
- Modules optionnels (`tables`, `wifi`, `loyalty`…) **développés mais désactivés** via `ENABLED_MODULES` pour La Z Pizza (emporter / livraison / web, pas de salle).
- **2ᵉ boutique** même client : 2ᵉ VPS (simple) ou modèle `Site` en BDD (futur).

### Workflow technicien

```
PHASE DEV (chez toi)                 PHASE LIVRAISON (chez le client)
────────────────────                 ─────────────────────────────────
Ton VPS + tes devices                Son VPS (ou le même migré) + SES devices
SumUp sandbox (ton compte)           SumUp live (son compte)
Mailpit / SMTP test                  SMTP prod (Hostinger ou client)
Jumelage tes SUNMI/tablettes         Reset jumelage → jumeler son matériel
Recette + commande test              Recette sur place + mise en service
```

**Important** : tu ne déplaces pas ton matériel chez le client. Tu livres le logiciel + la procédure CRM.

### Sécurité réseau

- Au **premier déploiement** : seuls **site web + CRM + livreur** sont accessibles depuis Internet.
- **POS / KDS** : bloqués tant que `onboardingComplete` n’est pas fait dans le CRM.
- Ensuite : accès `/pos` et `/kitchen` depuis l’**IP publique WAN** du restaurant (bouton « Utiliser l’IP de ce réseau » sur place).
- Le **MAC** des tablettes n’est pas visible au VPS (NAT) — filtre par **IP publique de la box** (toutes les tablettes du shop partagent la même).

### Impression

| Device       | Imprimante primaire              | Secours                 |
| ------------ | -------------------------------- | ----------------------- |
| POS SUNMI    | Intégrée (`window.SunmiPrinter`) | Epson comptoir (IP LAN) |
| POS tablette | Epson comptoir                   | —                       |
| KDS          | Epson cuisine                    | —                       |

Impression = **locale** (tablette → imprimante LAN). Le VPS envoie les `PrintJob` via Socket.

### Chaîne commande

```
Web / POS / (futur Deliveroo-Uber) → API → KDS temps réel
Checkout SumUp (re-vérifié via API) → CONFIRMED → order:new + PrintJob
KDS : PREPARING → READY → (étiquette sac) → OUT_FOR_DELIVERY → livreur APK
```

### Legacy

- Dossier `client/` (Vite) : **mort**, tout est dans `app.pizzeria.fr/`.
- Roadmap code : P0–P5 faits en labo ; **P6** = agrégateurs ; **à développer** = `/admin/devices` (jumelage, recette, onboarding).

---

## 2. FQDN & infra VPS

### CDC La Z Pizza (cible client final)

| Host              | Usage                     |
| ----------------- | ------------------------- |
| `pizzeria.fr`     | Site public               |
| `app.pizzeria.fr` | OPS : admin, pos, kitchen |
| `api.pizzeria.fr` | API Express               |

### Ton VPS gsms-school (référence infra)

D’après `gsms-school/deploy/gsms/.env` :

| Paramètre             | Valeur gsms                                                                |
| --------------------- | -------------------------------------------------------------------------- |
| `DOMAIN` / `CRM_HOST` | `hosting-global-it-ss.com`                                                 |
| SMTP                  | `smtp.hostinger.com:465` (SSL)                                             |
| Traefik               | `EXTERNAL_TRAEFIK=true` (même modèle que `deploy/docker-compose.prod.yml`) |

Tu peux héberger La Z Pizza sur **le même VPS** que gsms avec d’**autres hostnames** Traefik (`pizzeria.fr`, etc.) ou un VPS dédié client — la procédure est identique.

### DNS à créer (chez le registrar / Hostinger)

```
pizzeria.fr          A    → IP_VPS
app.pizzeria.fr      A    → IP_VPS
api.pizzeria.fr      A    → IP_VPS
```

---

## 3. Variables d’environnement — dev vs prod client

**Ne jamais committer les secrets.** Fichiers :

- Dev : `server/.env`, `app.pizzeria.fr/.env.local`
- Prod : `.env` à la racine Docker (voir `deploy/.env.production.example`)

### Domaines & URLs

| Variable              | Dev (ton labo)              | Prod client                                   |
| --------------------- | --------------------------- | --------------------------------------------- |
| `PUBLIC_HOST`         | `pizzeria.test` / localhost | `pizzeria.fr`                                 |
| `OPS_HOST`            | `app.pizzeria.test`         | `app.pizzeria.fr`                             |
| `API_HOST`            | `api.pizzeria.test`         | `api.pizzeria.fr`                             |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001`     | `https://api.pizzeria.fr/api`                 |
| `PUBLIC_SITE_URL`     | `http://pizzeria.test`      | `https://pizzeria.fr`                         |
| `FRONTEND_URL`        | localhost, `.test`          | `https://pizzeria.fr,https://app.pizzeria.fr` |

### SumUp (comptoir + paiement en ligne)

| Variable              | Dev                          | Prod client             |
| --------------------- | ---------------------------- | ----------------------- |
| `SUMUP_API_KEY`       | clé sandbox (ton compte)     | clé live (son compte)   |
| `SUMUP_MERCHANT_CODE` | code marchand sandbox        | code marchand live      |
| `API_PUBLIC_BASE_URL` | tunnel/URL locale accessible | `https://api.<domaine>` |

Pas de webhook à configurer côté dashboard SumUp — le checkout envoie son statut au
`return_url` fourni à la création (`{API_PUBLIC_BASE_URL}/api/payments/sumup-checkout/webhook`),
et ce callback n'est de toute façon qu'un signal : le serveur re-vérifie toujours le statut réel
via `GET /v0.1/checkouts/{id}` avant de confirmer une commande.

### Email (SMTP)

RestaurantOS utilise `EMAIL_*` (server). Équivalent gsms → pizzeria :

| RestaurantOS               | gsms-school            | Exemple prod            |
| -------------------------- | ---------------------- | ----------------------- |
| `EMAIL_SERVER_HOST`        | `SMTP_HOST`            | `smtp.hostinger.com`    |
| `EMAIL_SERVER_PORT`        | `SMTP_PORT`            | `465`                   |
| `EMAIL_SERVER_USER`        | `SMTP_USER`            | `commandes@pizzeria.fr` |
| `EMAIL_SERVER_PASSWORD`    | `SMTP_PASS`            | _(secret)_              |
| `EMAIL_FROM`               | `SMTP_FROM`            | `commandes@pizzeria.fr` |
| `PUBLIC_SITE_URL`          | `NEXT_PUBLIC_SITE_URL` | `https://pizzeria.fr`   |
| `ADMIN_NOTIFICATION_EMAIL` | `CONTACT_TO_EMAIL`     | email gérant            |

**Dev** : Mailpit Laragon (`127.0.0.1:1025`) — voir `server/.env.example`.

### Auth & modules

| Variable                        | Notes                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `JWT_SECRET` / `REFRESH_SECRET` | **Nouveaux** en prod (`openssl rand -base64 32`)                                     |
| `BUSINESS_ID`                   | UUID seed Prisma du client                                                           |
| `ENABLED_MODULES`               | V1 La Z Pizza : `menu,kitchen,orders,reports,users,settings,expenses,loyalty,shifts` |
| `DRIVER_ACCESS_PIN`             | PIN livreur (ou `settings.driverAccessPin` en BDD)                                   |
| `NODE_ENV`                      | `production`                                                                         |

### APK Android (`android/app/build.gradle.kts`)

| Build   | `POS_URL`                     |
| ------- | ----------------------------- |
| debug   | LAN dev                       |
| release | `https://app.pizzeria.fr/pos` |

---

## 4. Sentry (monitoring erreurs)

Déjà intégré côté **API** : `server/src/sentry.ts` — variable `SENTRY_DSN`.

| Variable                 | Où                              | Rôle                     |
| ------------------------ | ------------------------------- | ------------------------ |
| `SENTRY_DSN`             | `server/.env`                   | Erreurs Express          |
| `NEXT_PUBLIC_SENTRY_DSN` | build Next (à ajouter si front) | Erreurs navigateur / POS |

**À faire** :

1. Créer un projet Sentry (org perso ou client).
2. Copier le DSN dans `.env` prod.
3. Optionnel : source maps Next en CI.

**gsms-school** : `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` dans `deploy/gsms/.env.example` — même pattern.

---

## 5. WhatsApp / notifications client

### État actuel du code

- **Email** : `server/src/lib/mail-service.ts` — confirmation commande, mises à jour statut.
- **SMS** : `server/src/lib/notifications.ts` — Twilio si `SMS_PROVIDER=twilio`.
- **Stub** : sans `SMS_PROVIDER`, les SMS sont logués en console seulement.

### Option A — Twilio SMS (déjà prévu)

```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+33...    # numéro SMS Twilio
SMS_SENDER_NAME=La Z Pizza
```

**À faire** : compte Twilio, numéro SMS FR, crédit, tester `notifyOrderStatusChange` sur changement statut.

### Option B — Twilio WhatsApp

Même API, autre `From` :

```env
SMS_PROVIDER=twilio_whatsapp   # à implémenter (petit patch notifications.ts)
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   # sandbox puis numéro Business approuvé
```

**Prérequis Twilio WhatsApp** :

1. Compte Twilio vérifié.
2. **Sandbox** WhatsApp (dev) ou **WhatsApp Business** approuvé (prod).
3. Templates de messages **pré-approuvés** par Meta pour les notifications proactives (statut commande).
4. Patch code : `From=whatsapp:...` + éventuellement Content SID pour templates.

### Option C — WhatsApp Business Cloud API (Meta direct)

Sans Twilio — API Graph Meta :

```env
WHATSAPP_PROVIDER=meta
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
```

**Prérequis** :

1. Meta Business Manager.
2. Application WhatsApp Business.
3. Numéro de téléphone vérifié.
4. Templates message approuvés.
5. **Nouveau module** `server/src/lib/whatsapp-meta.ts` + branchement dans `notifications.ts`.

### Recommandation

| Phase            | Canal                                               |
| ---------------- | --------------------------------------------------- |
| **V1 livraison** | Email (SMTP Hostinger) + SMS Twilio si budget       |
| **V1.1**         | Twilio WhatsApp (sandbox dev → prod approuvé)       |
| **Plus tard**    | Meta direct si volume élevé (moins de marge Twilio) |

**Cas d’usage WhatsApp** : « Commande #42 en préparation », « En route », code livraison — mêmes textes que SMS dans `STATUS_SMS_LABEL`.

---

## 6. CRM `/admin/devices` (implémenté)

| Fonction          | Statut                                                                   |
| ----------------- | ------------------------------------------------------------------------ |
| Mode déploiement  | POS/KDS bloqués si `onboardingComplete` false (prod)                     |
| IP WAN boutique   | Bouton « Utiliser l’IP de ce réseau » → `settings.devices.allowedWanIps` |
| Jumelage devices  | Code 6 chiffres + bouton « Jumeler » sur POS/KDS                         |
| Dissocier         | CRM → liste appareils                                                    |
| Imprimantes Epson | IP LAN cuisine + comptoir                                                |
| Recette boutique  | Panneau diagnostics + validation                                         |
| Mise en service   | `onboardingComplete` — admin uniquement                                  |
| Reset onboarding  | Passage labo → client                                                    |

Stockage : `Business.settings.devices` (JSON Prisma).  
API : `GET/POST /api/devices/*` — voir `server/src/routes/devices.ts`.

---

## 7. Étapes — développement sur ton VPS labo

### 7.1 Prérequis locaux / VPS

- [ ] Repo cloné sur ton VPS (`/opt/pizzeria` ou équivalent)
- [ ] Docker + Traefik (réutiliser stack gsms : `EXTERNAL_TRAEFIK=true`)
- [ ] DNS de test ou hosts locaux
- [ ] PostgreSQL 16

### 7.2 Fichier `.env` labo

- [ ] Copier `deploy/.env.production.example` → `.env`
- [ ] `SUMUP_*` = **sandbox** (clés déjà dans `server/.env` dev — ne pas committer)
- [ ] `EMAIL_*` = Mailpit ou SMTP Hostinger test
- [ ] `JWT_SECRET` / `REFRESH_SECRET` générés
- [ ] `ENABLED_MODULES` selon modules à tester
- [ ] `SENTRY_DSN` = projet Sentry dev (optionnel)
- [ ] `SMS_PROVIDER` vide (stub) ou `twilio` pour tests

### 7.3 Build & run

```bash
cd /opt/pizzeria
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml build
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d
docker compose exec server npx prisma migrate deploy
docker compose exec server npx tsx prisma/seed.ts
```

### 7.4 SumUp dev

`API_PUBLIC_BASE_URL` doit pointer sur une URL accessible depuis Internet (tunnel type ngrok en
local, ou directement l'URL du VPS labo) — c'est là que SumUp envoie le statut du checkout.

Tester : commande web → paiement carte test SumUp → checkout confirmé → KDS + PrintJob.

### 7.5 Devices labo

- [ ] APK debug sur SUNMI / tablettes
- [ ] (Futur) `/admin/devices` : jumelage + recette
- [ ] (Actuel) Traefik IP ou middleware app — voir `deploy/README.md`

### 7.6 Recette P5/P6

- [ ] `docs/smoke-checklist-pizzeria-v1.md`
- [ ] `docs/webview-sunmi-checklist.md`
- [ ] Commande test bout en bout

---

## 8. Étapes — livraison chez le client

### 8.1 Avant la visite

- [ ] VPS client prêt (ou migration DNS vers prod)
- [ ] `.env` prod préparé **sans** IP boutique (SumUp **live**, SMTP client, secrets **neufs**)
- [ ] `API_PUBLIC_BASE_URL` = `https://api.<domaine>` (callback checkout SumUp)
- [ ] BDD seedée (menu client) — **pas** les commandes test du labo

### 8.2 Sur place (ton portable au Wi‑Fi du shop)

1. [ ] CRM `/admin` — login
2. [ ] (Futur) `/admin/devices` → « Utiliser l’IP de ce réseau »
3. [ ] Jumeler SUNMI, tablette caisse, KDS
4. [ ] Saisir IP LAN Epson cuisine + comptoir
5. [ ] Tests impression chaque binôme
6. [ ] Recette + commande test (1 paiement réel minimal possible)
7. [ ] « Mise en service »
8. [ ] Vérifier : `/pos` inaccessible depuis 4G hors shop

### 8.3 Remise au client

- [ ] Compte admin CRM
- [ ] PIN caisse / cuisine / livreur
- [ ] Pas de clés SumUp sandbox restantes
- [ ] Doc courte « coupure électricité / papier imprimante »

### 8.4 Changement matériel plus tard

- [ ] CRM → dissocier device HS → associer nouveau → re-test impression

---

## 9. Roadmap code (ordre suggéré)

| #   | Tâche                                                               | Priorité                   |
| --- | ------------------------------------------------------------------- | -------------------------- |
| 1   | `/admin/devices` + `settings.devices` + onboarding                  | ✅ fait                    |
| 2   | Garde POS/KDS (`DeviceOnboardingGate` + API access-status)          | ✅ fait                    |
| 3   | Compléter `deploy/.env.production.example` (EMAIL, SENTRY, SMS, WA) | ✅ fait                    |
| 4   | Badge CRM SumUp configuré/non configuré                             | ✅ (dans AdminDevicesView) |
| 5   | Fallback impression Epson (`print-job-handler` + pont Android)      | ✅ fait                    |
| 6   | APK flavors (pos-sunmi, pos-tablet, kds, livreur)                   | ✅ fait                    |
| 7   | Twilio WhatsApp + Meta WA                                           | ✅ fait                    |
| 8   | `NEXT_PUBLIC_SENTRY_DSN` front                                      | ✅ fait                    |
| 9   | Sync IP CRM → Traefik file provider                                 | ✅ fait                    |
| 10  | Nettoyage legacy `client/` + CI                                     | P4                         |

---

## 10. Fichiers utiles du repo

| Fichier                                | Rôle                       |
| -------------------------------------- | -------------------------- |
| `deploy/docker-compose.prod.yml`       | Labels Traefik             |
| `deploy/.env.production.example`       | Template secrets prod      |
| `deploy/README.md`                     | Install rapide + filtre IP |
| `docs/smoke-checklist-pizzeria-v1.md`  | Recette fonctionnelle      |
| `docs/webview-sunmi-checklist.md`      | Go/no-go SUNMI             |
| `MIGRATION-ROADMAP.md`                 | P0–P6                      |
| `android/README.md`                    | APK WebView                |
| `server/.env.example`                  | Toutes les variables API   |
| `gsms-school/deploy/gsms/.env.example` | Référence SMTP / Traefik   |

---

## 11. Checklist « prod client prête »

- [ ] FQDN + SSL OK
- [ ] SumUp **live** configuré (`SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE`, `API_PUBLIC_BASE_URL`)
- [ ] SMTP + email commande reçu
- [ ] Sentry DSN prod (optionnel)
- [ ] SMS/WhatsApp configuré ou désactivé sciemment
- [ ] Onboarding devices terminé
- [ ] IP WAN boutique enregistrée
- [ ] Commande test passée puis purgée
- [ ] Aucune clé `sk_test` / `pk_test` active
- [ ] Sauvegardes cron `deploy/scripts/backup-vps.sh`

---

_Dernière mise à jour : conversation architecture déploiement — labo gsms / livraison client La Z Pizza._
