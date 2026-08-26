# La Z Pizza — Plateforme de commande & d'encaissement pour pizzeria

> Documentation technique du projet : architecture, structure du dépôt, technologies, modules et spécifications.
> Socle : **RestaurantOS** (open source, MIT), adapté et étendu selon le [cahier des charges v2.4](cahier-des-charges-pizzeria-v2.4.md).
> Dernière mise à jour : juillet 2026.

---

## 1. Vue d'ensemble

Solution unifiée pour une pizzeria permettant de gérer :

- les **commandes en ligne** (site web responsive : click & collect + livraison, paiement **SumUp**) ;
- les **commandes sur place** via une **APK caisse** (tablette comptoir) ;
- l'**affichage cuisine (KDS)** temps réel via une **APK KDS** (tablette cuisine) ;
- les **tournées de livraison** via une **APK livreur** (smartphone) — livraison **uniquement prépayée en ligne**, le livreur n'encaisse jamais ;
- l'**impression thermique** des reçus (comptoir) et tickets de préparation (cuisine) sur **imprimantes Epson TM** en réseau local (ePOS-Print / ESC/POS TCP 9100) ;
- la **conformité fiscale française** (art. 286, I-3° bis du CGI — critères ISCA) : module fiscal intégré (chaînage cryptographique des tickets, clôtures Z, journal d'événements, archivage), avec attestation individuelle de l'éditeur (rétablie par la loi de finances 2026).

**Historique du pivot** (détails dans le cahier des charges) :

| Version | Évolution                                                                                                                                                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0    | Socle RestaurantOS générique (SPA Vite `client/`, bilingue AR/EN, PostgreSQL)                                                                                                                                                     |
| v2.1    | Abandon de Vite → toute l'UI dans **Next.js** (`app.pizzeria.fr/`) ; API Express conservée ; Traefik sur VPS                                                                                                                      |
| v2.2    | Prérequis WebView ≥ 64 ; routage par hôte ; `client/` exclu du build/CI                                                                                                                                                           |
| v2.3    | Conformité fiscale via intégration API caisse certifiée (type Zelty)                                                                                                                                                              |
| v2.4    | **Abandon du matériel SUNMI** (Android bridé, WebView non maintenable) → APK WebView conservées sur **tablettes standard** + **2 imprimantes Epson** ; parcours livreur ajouté ; option de repli fiscale ISCA en propre maintenue |

---

## 2. Architecture

```
                        ┌──────────────────────────── VPS (Docker + Traefik) ───────────────────────────┐
                        │                                                                                │
  Client final ─────────┼──► pizzeria.fr / app.pizzeria.fr        ┌──────────────────────┐               │
  (navigateur)          │    ┌──────────────────────────┐  HTTP   │  server/ (Express)   │   Prisma      │
                        │    │ app.pizzeria.fr (Next.js)│ ───────►│  API REST /api/*     │ ──────► ┌───┐ │
  APK caisse (tablette)─┼──► │  (public)  site + suivi  │  WSS    │  Socket.io temps réel│         │ P │ │
  APK KDS (tablette) ───┼──► │  (ops)     pos/kitchen/  │ ◄──────►│  JWT + rate limiting │         │ G │ │
  APK livreur (mobile) ─┼──► │            admin         │         │  Module fiscal ISCA  │         └───┘ │
                        │    └──────────────────────────┘         └──────┬───────────────┘  PostgreSQL 16│
                        │                                                │                                │
                        │         SumUp (paiement en ligne + lecteur) ──┤   MinIO (sauvegardes)          │
                        │         Sentry (monitoring erreurs) ───────────┤   Nodemailer (e-mails)         │
                        └────────────────────────────────────────────────┼────────────────────────────────┘
                                                                         │
       LAN pizzeria :  tablettes ──► Epson TM comptoir (reçus) + Epson TM cuisine (tickets) — ePOS/TCP 9100
```

- **Frontend** : Next.js App Router, deux groupes de routes — `(public)` (site client) et `(ops)` (caisse, cuisine, back-office) — avec **routage par hôte** (middleware) : `pizzeria.fr` → public, `app.pizzeria.fr` → ops.
- **Backend** : API Express séparée (`server/`), source de vérité métier, Prisma → PostgreSQL, Socket.io pour le temps réel (KDS, suivi commande, livreur).
- **APK Android** (`android/`) : enveloppes WebView (Kotlin) chargeant les modules Next.js, avec ponts JavaScript natifs pour l'impression (Epson LAN, ex-SUNMI conservé) et l'info device.
- **Multi-tenant neutralisé** : le schéma conserve `businessId` partout, mais un seul `Business` est créé au seed (`BUSINESS_ID` en variable d'environnement).
- **Feature flags** : `ENABLED_MODULES` masque la navigation et désactive les routes API des modules hors périmètre (wifi, tables, réservations, fidélité, shifts, dépenses…) sans supprimer le code.

---

## 3. Structure du dépôt

```
RestaurantOS/
├── app.pizzeria.fr/          # ★ Frontend Next.js (UI actuelle)
│   ├── app/
│   │   ├── (public)/         # Site client : menu, commander, panier + checkout,
│   │   │                     #   suivi/[token], livreur/[token], wifi
│   │   ├── (ops)/            # Interne : login, pos, kitchen, monitor,
│   │   │   └── admin/        #   menu, orders, reports, stock, fiscal, invoices,
│   │   │                     #   loyalty, delivery, devices, planning, shifts,
│   │   │                     #   employees/users, expenses, settings, tables,
│   │   │                     #   reservations, wifi
│   │   └── api/public/       # Route handlers Next (proxy public) : menu, orders,
│   │                         #   payments, delivery, time-slots, track-token…
│   ├── components/  hooks/  lib/  public/  styles/
│   └── package.json          # Next 16, React 19, SumUp, Leaflet, Sentry
│
├── server/                   # ★ API Express + Prisma + Socket.io
│   ├── src/
│   │   ├── routes/           # 22 modules REST : auth, menu, orders, pos, payments,
│   │   │                     #   delivery, fiscal, invoices, stock, print-jobs,
│   │   │                     #   devices, licenses, backups, public, reports,
│   │   │                     #   employees, expenses, loyalty, reservations,
│   │   │                     #   settings, tables, wifi
│   │   ├── middleware/       # auth JWT, rate limiting, sanitization, audit
│   │   ├── sockets/          # Handlers Socket.io
│   │   ├── services/         # Logique métier (impression, fiscal…)
│   │   └── tests/            # Jest + Supertest
│   ├── prisma/               # schema.prisma (38 modèles), migrations, seed.ts
│   └── scripts/              # sync-catalog, fiscal-verify-chain, seed-ops…
│
├── android/                  # ★ APK WebView Kotlin (Gradle, JDK 17)
│   └── 4 flavors : posSunmi / posTablet / kds / livreur
│
├── client/                   # ⚠ Ancienne SPA Vite (React 18) — DÉPRÉCIÉE
│                             #   exclue du build Docker et de la CI (cf. CDC §A9)
│
├── shared/                   # Types TypeScript partagés (types.ts)
├── deploy/                   # Prod VPS : docker-compose.prod.yml / ops.yml,
│                             #   Traefik, scripts (install, backup MinIO, APK build…)
├── docs/                     # Conformité fiscale (art. 286 CGI, BOFiP, checklist),
│                             #   architecture matériel, TPE, déploiement VPS, roadmap v2
├── tests/load/               # Scripts k6 (smoke, average, stress, spike)
├── scripts/                  # Orchestration dev (dev.mjs, backup db)
├── .github/                  # CI (ci.yml), Dependabot, templates
├── docker-compose.yml        # Stack locale : postgres + server + web
├── Caddyfile                 # Reverse proxy du socle d'origine (remplacé par Traefik en prod)
├── cahier-des-charges-pizzeria-v2.4.md   # ★ Spécifications de référence
└── package.json              # Racine : scripts unifiés, husky, lint-staged, commitlint
```

★ = dossiers actifs du produit actuel · ⚠ = conservé mais gelé

---

## 4. Technologies

### Frontend — `app.pizzeria.fr/` (actif)

| Domaine      | Technologie                                                         |
| ------------ | ------------------------------------------------------------------- |
| Framework    | **Next.js 16** (App Router) + **React 19** + TypeScript 5.7         |
| Styles       | Tailwind CSS 3.4, PostCSS, Autoprefixer                             |
| Temps réel   | socket.io-client 4.8                                                |
| Paiement     | SumUp (checkout online + lecteur Solo)                              |
| Cartographie | Leaflet (zones/tournées de livraison)                               |
| Tableaux     | TanStack React Table                                                |
| Icônes       | lucide-react                                                        |
| Monitoring   | Sentry (`@sentry/nextjs`)                                           |
| i18n         | Français uniquement, devise EUR (montants en **centimes**, entiers) |

### Backend — `server/`

| Domaine             | Technologie                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| Runtime / framework | **Node.js ≥ 20**, **Express 4**, TypeScript 5.6, tsx (dev)                                                  |
| ORM / BDD           | **Prisma 6** → **PostgreSQL 16** (Laragon en local, conteneur en prod)                                      |
| Temps réel          | **Socket.io 4.8**                                                                                           |
| Auth                | JWT (access + refresh rotation), bcryptjs, rôles (dont **livreur**), PIN employé                            |
| Validation          | Zod                                                                                                         |
| Paiement            | SumUp Cloud API (checkout + reader)                                                                         |
| E-mails             | Nodemailer + React Email (templates)                                                                        |
| Stockage objet      | MinIO (sauvegardes, archives)                                                                               |
| Upload              | Multer · QR codes : qrcode                                                                                  |
| Docs API            | Swagger/OpenAPI (`/api/docs`) via swagger-jsdoc + swagger-ui-express                                        |
| Sécurité HTTP       | Helmet (CSP), express-rate-limit (paliers par endpoint), HPP, CORS whitelist, sanitization XSS, compression |
| Monitoring          | Sentry (`@sentry/node` + profiling)                                                                         |

### Android — `android/`

| Domaine         | Technologie                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Langage / build | **Kotlin**, Gradle (Kotlin DSL), JDK 17, Android 7.1+                                                                                                         |
| Principe        | WebView chargeant les modules Next.js, navigation verrouillée sur `ALLOWED_HOST`                                                                              |
| Flavors         | `posSunmi` → `/pos` · `posTablet` → `/pos` · `kds` → `/kitchen` · `livreur` → `/livreur`                                                                      |
| Ponts JS        | `window.EpsonPrinter.printToLan(ip, texte)` (ESC/POS TCP 9100) · `window.SunmiPrinter.*` (SDK InnerPrinter, hérité) · `window.LaZPizzaDevice.getDeviceInfo()` |
| Appairage       | Code 6 chiffres (CRM) au premier lancement, puis PIN employé                                                                                                  |
| Sécurité        | Aucune donnée CB dans l'APK — TPE physique indépendant                                                                                                        |

### Impression

- **Epson ePOS-Print (SDK JS)** depuis les APK vers les imprimantes **Epson TM** (ex. TM-m30III) en IP fixe sur le LAN — comptoir (reçus) et cuisine (tickets de préparation).
- Repli : pont natif dans l'APK (relais ESC/POS TCP 9100).
- Suivi via la table `PrintJob` (états papier/capot/hors-ligne) ; impression fonctionnelle **sans Internet** (LAN seul).
- Côté Next.js : `lib/print/sunmi-printer.ts`, `lib/print/epson-lan-print.ts`.

### Infrastructure & DevOps

| Domaine            | Technologie                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| Conteneurs         | Docker + Docker Compose (`docker-compose.yml` local ; `deploy/docker-compose.prod.yml` + `ops.yml` en prod) |
| Reverse proxy prod | **Traefik** (VPS Hostinger, HTTPS Let's Encrypt) — routage par hôte `pizzeria.fr` / `app.pizzeria.fr`       |
| Dev local          | **Laragon** (Windows) + scripts `scripts/dev.mjs`                                                           |
| CI/CD              | GitHub Actions (`.github/workflows/ci.yml`) : lint, typecheck, tests, service PostgreSQL                    |
| Qualité            | Husky + lint-staged (ESLint `--max-warnings=0` + Prettier pré-commit), commitlint (Conventional Commits)    |
| Sauvegardes        | Scripts VPS (`deploy/scripts/backup-vps.sh`, MinIO, cron), `BackupLog` en base                              |

---

## 5. Base de données (Prisma — 38 modèles)

| Groupe                | Modèles                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant & utilisateurs | `Business`, `User` (rôles admin/caisse/cuisine/livreur, PIN)                                                                                             |
| Catalogue             | `MenuCategory`, `MenuItem`, `MenuModifier`, `ModifierOption`                                                                                             |
| Commandes             | `Order` (statuts `PENDING_PAYMENT` → `CONFIRMED` → `PREPARING` → `READY` → `OUT_FOR_DELIVERY` → livrée), `OrderItem`, `GuestCheckoutDraft`, `TimeSlot`   |
| Livraison             | `DeliveryZone` (zones, tarifs, suivi par token)                                                                                                          |
| Stock                 | `StockItem`, `MenuItemRecipe`, `StockMovement`                                                                                                           |
| Impression & devices  | `PrintJob`, appairage devices (route `devices.ts`)                                                                                                       |
| **Fiscal (ISCA)**     | `FiscalSequence`, `FiscalTicket` (chaînage cryptographique), `FiscalClosure` (clôtures Z), `FiscalDayPreclose`, `FiscalEvent` (journal), `FiscalArchive` |
| Facturation           | `Invoice`, `InvoiceLine`, `EmailLog`                                                                                                                     |
| RH / planning         | `Shift`, `EmployeeScheduleEntry`, `Attendance`, `Expense`                                                                                                |
| Fidélité              | `LoyaltyProgram`, `LoyaltyCustomer`, `LoyaltyTransaction`                                                                                                |
| Modules désactivables | `Table`, `Reservation`, `WifiQrCode`, `WifiSession`                                                                                                      |
| Système               | `AuditLog`, `License`, `BackupLog`                                                                                                                       |

Conventions : montants en **centimes (entiers)**, TVA multi-taux (5,5 / 10 / 20 %), `businessId` sur toutes les entités.

---

## 6. Modules fonctionnels

### Parcours client (public — `pizzeria.fr`)

- **Menu & commande en ligne** : catégories, options/suppléments (modifiers), formules, créneaux horaires.
- **Panier & checkout** : click & collect ou livraison (zones + devis), paiement SumUp, commande invité (pas de compte client en V1).
- **Suivi de commande** : page `suivi/[token]` temps réel (Socket.io), position/statut livreur.
- Cycle web : `PENDING_PAYMENT` → confirmation SumUp (re-vérif API) → `CONFIRMED` → push temps réel + impression cuisine + enregistrement fiscal.

### Opérations (ops — `app.pizzeria.fr`)

- **POS / Caisse** (APK tablette comptoir) : prise de commande sur place, encaissement (espèces, carte TPE, « payé en ligne »), impression reçu, mode dégradé hors-ligne (APK résidente).
- **KDS Cuisine** (APK tablette) : tickets temps réel, notifications sonores, impression automatique des bons de préparation.
- **Livreur** (APK smartphone) : liste des commandes à livrer (déjà payées), itinéraire (intent Google Maps), statuts `OUT_FOR_DELIVERY` → livrée, PIN d'accès (`DRIVER_ACCESS_PIN`).
- **Back-office admin** : commandes, menu, rapports/analytics, stock & recettes, facturation, fiscal (clôtures, exports), livraison (zones, tournées, récap jour), devices, planning/heures, employés, dépenses, fidélité, réglages — plus tables/réservations/wifi (désactivés par feature flags).
- **Monitor** : supervision POS/kitchen.

### Conformité fiscale (module ISCA en propre)

Développé comme prévu au §2bis.4 du cahier des charges (option de repli) :

- **Inaltérabilité** : tickets chaînés cryptographiquement (`FiscalTicket`), séquences (`FiscalSequence`) ;
- **Sécurisation** : journal des événements techniques (`FiscalEvent`), audit log ;
- **Conservation** : clôtures Z (`FiscalClosure`), pré-clôtures journalières ;
- **Archivage** : `FiscalArchive` + répertoire `FISCAL_ARCHIVE_DIR`, sauvegarde MinIO ;
- Outils : `npm run fiscal:verify-chain` (vérification d'intégrité de la chaîne), `fiscal:repair-jet`, `fiscal:lab-reset` ; procédures dans `deploy/FISCAL-OPS.md` et `docs/` (attestation BOFiP, checklist remise client).

---

## 7. API REST (`server/src/routes/` — 22 modules)

`auth` · `menu` · `orders` · `pos` · `payments` (SumUp) · `delivery` · `fiscal` · `invoices` · `stock` · `print-jobs` · `devices` · `public` (endpoints sans auth) · `reports` · `employees` · `expenses` · `loyalty` · `reservations` · `settings` · `tables` · `wifi` · `licenses` · `backups`

Documentation interactive : **Swagger UI sur `/api/docs`** · Healthcheck : `/api/health`.

---

## 8. Démarrage & scripts

### Dev local (Laragon / Windows)

```bash
npm run setup        # install racine + server + app.pizzeria.fr, prisma generate/push, seed
npm run dev          # stack dev (web Next.js :3000 + API :3001)
npm run dev:mobile   # variante accès LAN (tablettes/APK en debug)
npm run dev:stop     # libère les ports
```

- Web : http://localhost:3000 · API : http://localhost:3001/api/health · Swagger : http://localhost:3001/api/docs

### Base de données

```bash
npm run db:migrate   # prisma migrate dev
npm run db:seed      # seed de dev
npm run db:repair    # réparation push/génération
npm run sync:catalog # synchronisation du catalogue
npm run seed:ops     # données opérationnelles
npm run db:backup:win
```

### Tests & qualité

| Commande                                                          | Portée                                           |
| ----------------------------------------------------------------- | ------------------------------------------------ |
| `npm test` / `npm run test:coverage`                              | Backend — Jest + Supertest                       |
| `npm run test:client`                                             | Ancienne SPA — Vitest + RTL + MSW (legacy)       |
| `cd client && npm run test:e2e`                                   | E2E Playwright (legacy)                          |
| `npm run test:smoke` / `test:load` / `test:stress` / `test:spike` | Charge — k6                                      |
| `npm run lint` / `typecheck` / `format`                           | ESLint, tsc, Prettier (server + app.pizzeria.fr) |

### Docker & prod

```bash
npm run docker:up            # stack locale (postgres + api + web)
# Prod VPS : deploy/docker-compose.prod.yml + Traefik — voir docs/VPS-DEPLOIEMENT.md
# APK : cd android && ./gradlew assemblePosTabletRelease assembleKdsRelease assembleLivreurRelease
```

---

## 9. Variables d'environnement principales

| Variable                                                        | Rôle                                                             |
| --------------------------------------------------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`                                                  | PostgreSQL (`postgresql://user:pass@host:5432/pizzeria_app`)     |
| `JWT_SECRET` / `REFRESH_SECRET`                                 | Secrets JWT (≥ 32 caractères, distincts)                         |
| `BUSINESS_ID`                                                   | Tenant unique (multi-tenant neutralisé)                          |
| `ENABLED_MODULES`                                               | Feature flags des modules (menu, pos, kitchen, orders, reports…) |
| `FRONTEND_URL` / `PUBLIC_SITE_URL`                              | Origines CORS / hôtes public & ops                               |
| `SUMUP_API_KEY` / `SUMUP_MERCHANT_CODE` / `API_PUBLIC_BASE_URL` | Paiement en ligne (Checkout SumUp)                               |
| `DRIVER_ACCESS_PIN`                                             | PIN d'accès APK livreur                                          |
| `FISCAL_ARCHIVE_DIR`                                            | Répertoire des archives fiscales                                 |
| `MINIO_*`                                                       | Stockage objet (sauvegardes)                                     |
| `EMAIL_SERVER_*` / `EMAIL_FROM`                                 | SMTP notifications                                               |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`                         | Monitoring erreurs                                               |

Modèles complets : `server/.env.example`, `deploy/.env.production.example`.

---

## 10. Sécurité

- **Auth** : JWT access/refresh avec rotation, bcrypt, rôles (admin, caisse, cuisine, livreur), PIN employé sur les APK.
- **HTTP** : Helmet CSP strict, rate limiting par paliers (auth 5/15 min, strict 20/h, général 100/min), sanitization XSS (body/query/params), protection HPP, CORS whitelist, pas de stack traces en prod.
- **Paiements** : SumUp (checkout online + lecteur) ; aucune donnée carte côté plateforme ni APK.
- **APK** : navigation WebView restreinte à l'hôte autorisé.
- **Docker** : images multi-stage, utilisateur non-root.
- **Fiscal** : chaîne de tickets vérifiable (`fiscal:verify-chain`), journal d'événements, archivage.
- Politique de divulgation : [SECURITY.md](SECURITY.md).

---

## 11. Documents de référence

| Document                                                                                  | Contenu                                                                      |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [cahier-des-charges-pizzeria-v2.4.md](cahier-des-charges-pizzeria-v2.4.md)                | Spécifications contractuelles complètes (architecture, planning, conformité) |
| [docs/conformite-article-286-cgi.md](docs/conformite-article-286-cgi.md)                  | Analyse légale (loi anti-fraude TVA, critères ISCA)                          |
| [docs/attestation-logiciel-caisse-bofip.md](docs/attestation-logiciel-caisse-bofip.md)    | Attestation éditeur (BOFiP, LF 2026)                                         |
| [docs/architecture-materiel-client.md](docs/architecture-materiel-client.md)              | Matériel : tablettes, imprimantes Epson, réseau                              |
| [docs/VPS-DEPLOIEMENT.md](docs/VPS-DEPLOIEMENT.md) · [deploy/README.md](deploy/README.md) | Déploiement production VPS + Traefik                                         |
| [deploy/FISCAL-OPS.md](deploy/FISCAL-OPS.md)                                              | Exploitation du module fiscal                                                |
| [android/README.md](android/README.md)                                                    | Build & installation des APK                                                 |
| [CHANGELOG.md](CHANGELOG.md)                                                              | Historique des versions (Keep a Changelog)                                   |

---

## 12. Licence

Socle RestaurantOS distribué sous **licence MIT** ([LICENSE](LICENSE)) — usage et exploitation commerciale libres, notice de copyright conservée.
