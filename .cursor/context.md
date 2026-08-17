# Pizzeria — contexte projet

Solution digitale de **commande et d'encaissement** pour une pizzeria unique (single-tenant neutralisé via `BUSINESS_ID`).

**Référence métier :** `cahier-des-charges-pizzeria-v2.md` (v2.2, juillet 2026)

## Objectifs

1. Site public vitrine + commande en ligne (click & collect / livraison) avec paiement Stripe.
2. Back-office unique pour toutes les commandes (en ligne + comptoir).
3. Écran cuisine/comptoir (KDS) sur tablette en mode kiosque.
4. SUNMI V2 : POS sur place + imprimante tickets (en ligne + comptoir).
5. Hébergement VPS Hostinger (Docker + Traefik + Postgres), coûts récurrents minimaux.

## Structure monorepo

```
server/              # Express + Prisma + Socket.io + Stripe webhooks
app.pizzeria.fr/     # Next.js — TOUTE l'UI (remplace client/ Vite)
client/              # LEGACY Vite — ne plus développer, exclu build/CI/Docker
android/             # APK WebView SUNMI (à construire)
```

## Quatre interfaces (un seul Next.js : `app.pizzeria.fr/`)

| Module | Rôle | Route group | Domaine prod |
|--------|------|-------------|--------------|
| **A — Site public** | Landing, menu, panier, paiement, suivi | `app/(public)/` | `pizzeria.fr` |
| **B — POS SUNMI** | Commande comptoir, réception/impression web | `app/(pos)/` | `app.pizzeria.fr` |
| **C — KDS** | Colonnes Nouvelles / En préparation / Prêtes | `app/(kds)/` | `app.pizzeria.fr` |
| **D — Back-office** | Menu, horaires, historique, stats | `app/(admin)/` | `app.pizzeria.fr` |

L'API métier reste dans **Express** (`server/`) — pas de réécriture en routes Next.js.

## Stack

- **UI** : Next.js (`app.pizzeria.fr/`), Tailwind, shadcn/ui, **next-intl** (FR)
- **Routage** : `middleware.ts` par en-tête `Host` (`pizzeria.fr` vs `app.pizzeria.fr`)
- **API** : Express + Prisma (`server/`)
- **Base** : PostgreSQL (Laragon local, Docker prod)
- **Auth staff** : JWT Express (rôles `admin` / `employé`) — pas Auth.js
- **Temps réel** : Socket.io — pas SSE
- **Paiement** : Stripe Payment Element + webhook Express `payment_intent.succeeded`
- **App Android** : WebView **≥ Chrome 64** (prérequis phase 0) + `window.SunmiPrinter`
- **Mode dégradé POS** : IndexedDB + APK WebView résidente (pas de service worker V1)
- **Dev local** : Laragon (PostgreSQL + vhosts), ports 3000 (Next) / 3001 (Express)
- **Prod** : Docker Compose + **Traefik** (labels, réseau externe) — pas Caddy, pas Vite

## Hors périmètre V1

TPE protocolaire, fidélité, stocks, compta, WiFi invité, tables, réservations, shifts, dépenses, licences (feature flags OFF).

## Entités Prisma (cible — `server/prisma/schema.prisma`)

Socle RestaurantOS + ajouts : `TimeSlot`, `DeliveryZone`, `PrintJob`, `trackingToken` sur `Order`.

**Statuts :** `PENDING_PAYMENT` → `CONFIRMED` → `PREPARING` → `READY` → `COMPLETED` (+ `CANCELLED`)

## Workflow agent

1. Lire `server/prisma/schema.prisma` avant toute feature.
2. UI → `app.pizzeria.fr/` ; API → `server/src/routes/`.
3. Ne jamais ajouter de code dans `client/` (Vite legacy).
4. Pas de données bancaires côté POS — Stripe en ligne, TPE physique au comptoir.
5. **Roadmap priorisée :** `MIGRATION-ROADMAP.md` (P0 build → P1 menu BDD → P2 modules → P3/P4/P5).
