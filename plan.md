
# Suite POS Pizzeria — Plan de livraison

Style visuel repris de **pizza.gsms-security.com** (La Z Pizza) : fond sombre chaud (noir → brun brûlé), typo serif italique élégante ("Pizza artisanale à Fargues"), accents orange/rouge feu + vert "livraison", cartes arrondies, photos plein cadre, ambiance four à bois.

**Hébergement** : tu héberges toi-même. Stack = **TanStack Start** (Node/Cloudflare Worker compatible) + **PostgreSQL** (à toi de fournir : Postgres géré ou VPS), **Prisma** ou `postgres.js`, **NextAuth-like via lucia-auth** pour l'auth, **WebSockets** (temps réel KDS/livreur) via un service self-host (Socket.io ou Ably self-host). Lovable Cloud désactivé.

> Ce que tu demandes = **9 modules interconnectés**. Impossible en une itération. Je propose 6 phases. Tu valides une phase, je livre, on itère.

---

## Architecture globale

```text
                ┌───────────────────────────────┐
                │   Landing publique (Next-like)│
                │   Menu · Panier · Checkout    │
                └──────────────┬────────────────┘
                               │ REST + WS
┌───────────────┐   ┌──────────▼──────────┐   ┌────────────────┐
│ Deliveroo API │──▶│                     │◀──│ POS caisse     │
│ UberEats API  │──▶│   Core API (TSS)    │◀──│ tactile (PWA)  │
│ (webhooks)    │   │   Postgres + Redis  │   └────────────────┘
└───────────────┘   │                     │   ┌────────────────┐
                    │                     │◀──│ KDS cuisine    │
                    │                     │   │ + imprimante   │
                    │                     │   └────────────────┘
                    │                     │   ┌────────────────┐
                    │                     │◀──│ App livreur    │
                    └──────────┬──────────┘   │ (PWA + GPS)    │
                               │              └────────────────┘
                               ▼
                       Back-office CRM
              (menu, stocks, employés, stats, fisc)
```

---

## Phase 1 — Fondations + Landing + Commande en ligne  ⭐ *commence ici*

- Design system (couleurs feu/nuit, typo Fraunces + Inter, composants shadcn re-skinnés)
- Schéma Postgres : `restaurants`, `categories`, `products`, `variants`, `options`, `customers`, `orders`, `order_items`, `addresses`
- Landing publique : hero, carte interactive, panier, checkout (surplace / à emporter / livraison), zone de livraison géo (10 km)
- Auth client (email + magic link)
- Paiement Stripe (mode test)
- Confirmation SMS via GatewayAPI connector

## Phase 2 — Back-office CRM

- Login staff (rôles : admin, manager, caissier, cuisine, livreur)
- Gestion menu (produits, prix, photos, dispo, happy hours)
- Fiches clients, historique, fidélité points
- Import/export CSV, catalogues multi-sites

## Phase 3 — POS caisse + KDS cuisine

- Interface tactile plein écran (surplace / emporter / livraison / plan de salle)
- Tables, ouverture/fermeture ticket, split addition
- KDS temps réel (WebSocket) : bump commandes, minuteurs, priorités
- **Impression ticket** : intégration ESC/POS via service local (QZ Tray ou daemon `escpos-php`) — imprimante Epson/Star sur le réseau du resto
- Ticket cuisine + ticket livraison + ticket client

## Phase 4 — App livreur + Tournées

- PWA livreur (mobile), login, liste courses assignées
- Géolocalisation temps réel (Geolocation API + WS)
- Optimisation tournée (Mapbox Directions ou OSRM self-host)
- Statuts : pris en charge / en route / livré / échec, preuve photo
- Vue "carte des livreurs en direct" côté manager

## Phase 5 — Intégrations tierces + API caisse

- **Deliveroo API** (nécessite contrat Deliveroo Marketplace + credentials OAuth)
- **UberEats Integrations API** (contrat Uber Direct + client_id/secret)
- Webhook réception commandes → injection dans le KDS
- Sync menu → plateformes (push produits/prix/dispo)
- **API REST publique documentée** (OpenAPI) pour caisse tactile tierce : endpoints commandes, menu, stocks, tickets, avec API keys par restaurant

## Phase 6 — Salle, planning, stats, stocks, fisc, paramètres

- Plan de salle drag-and-drop, réservations, occupation temps réel
- Planning employés (shifts, pointage, coûts main d'œuvre)
- Dashboard stats (CA, panier moyen, top produits, heures pointe, canaux)
- Stocks : matières premières, recettes/BOM, décrément auto par vente, alertes seuils, inventaires
- Fiscalité FR : TVA multi-taux (10 % sur place / à emporter, 20 % alcools), export Z, ticket certifié NF525-compat, journal des événements inaltérable
- Paramètres app/landing/CRM (branding, horaires, zones livraison, taux TVA, imprimantes)

---

## Détails techniques

- **Repo mono** TanStack Start. Server functions pour l'app-interne, `/api/public/*` pour webhooks Deliveroo/UberEats et l'API caisse externe (HMAC + API key).
- **Temps réel** : Socket.io namespace `/kds`, `/pos`, `/couriers`.
- **Impression** : agent Node local dans le resto (fourni par nous, ~200 lignes) qui écoute WS et envoie ESC/POS aux imprimantes réseau. Docs pour Epson TM-m30, Star mC-Print.
- **Auth** : lucia-auth (session cookies chiffrés, table `users` + `sessions` en Postgres). Rôles via table `user_roles` séparée.
- **Cartes/routing** : Mapbox (clé à toi) ou OSRM auto-hébergé.
- **Déploiement** : Dockerfile fourni (app + worker WS + Postgres via docker-compose). Tu déploies sur ton VPS.
- **Secrets** : `.env` avec `DATABASE_URL`, `STRIPE_SECRET`, `DELIVEROO_CLIENT_ID/SECRET`, `UBEREATS_*`, `MAPBOX_TOKEN`, `SESSION_SECRET`.

---

## Ce dont j'ai besoin de toi (pour les phases avancées)

- **Phase 1** : nom du resto, adresse, horaires, zone de livraison, logo (si tu en as un), photos pizzas (sinon je génère)
- **Phase 3** : modèle exact d'imprimante ticket (ex. Epson TM-m30)
- **Phase 5** : contrats **Deliveroo Marketplace** et **Uber Direct / UberEats Integrations** signés + credentials (les API ne sont pas ouvertes librement)
- **Phase 6** : ton statut fiscal et si tu vises la certification NF525 stricte ou juste conformité TVA

---

## Ma proposition immédiate

Je démarre **Phase 1** maintenant : design system "La Z Pizza"-like + landing + menu + panier + checkout + schéma Postgres complet. Tu valides visuellement, ensuite j'enchaîne Phase 2.

Confirme-moi :
1. **On lance la Phase 1** ?
2. Nom + adresse du resto (ou je mets un placeholder "La Pizzeria") ?
3. Je génère les photos de pizzas ou tu les fourniras ?
