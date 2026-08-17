# Brief projet — Pizzeria (source : cahier des charges v2.1)

**Référence complète :** `cahier-des-charges-pizzeria-v2.md` (v2.2)

## Vision

Solution unifiée commande + encaissement pour **une pizzeria**, socle **RestaurantOS** (MIT) adapté :
- Commandes **en ligne** (Next.js + Stripe) et **sur place** (SUNMI V2)
- Impression tickets automatique sur terminal SUNMI V2 (58 mm)
- Suivi cuisine sur tablette (KDS)
- Back-office menu / horaires / stats
- **Pas d'abonnement SaaS** — VPS Hostinger ~5–15 €/mois

## Structure monorepo

| Dossier | Rôle |
|---------|------|
| `server/` | Express + Prisma + Socket.io + Stripe webhooks |
| `app.pizzeria.fr/` | Next.js — site public + POS + KDS + admin |
| `client/` | LEGACY Vite — ne plus utiliser |
| `android/` | APK WebView SUNMI |

## Modules

- **A** `(public)/` sur `pizzeria.fr` — landing SEO, menu, panier, Stripe, suivi token
- **B** `(pos)/` sur `app.pizzeria.fr` — POS SUNMI, impression pont natif
- **C** `(kds)/` — colonnes statuts, Socket.io
- **D** `(admin)/` — CRUD catalogue, horaires, historique, dashboard

## Stack technique

Next.js (`app.pizzeria.fr/`) · Express API (`server/`) · Prisma · PostgreSQL · JWT · Socket.io · Stripe · Docker · **Traefik** (prod) · Laragon (dev local) · APK WebView SUNMI

**Interdit :** Vite, Caddy, Auth.js, réécriture API en routes Next.js

## Hors scope V1

TPE intégré, fidélité, stocks, WiFi invité, tables, réservations, shifts, dépenses, licences (feature flags OFF).

## Fichiers Firecrawl liés

- `data-model.md` — entités Prisma
- `api-surface.md` — routes Express
- `ui-modules.md` — route groups Next.js
- `sunmi-printer.md` — pont impression V2
