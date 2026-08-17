# RestaurantOS → Pizzeria — Roadmap priorisée

**Dernière mise à jour :** juillet 2026  
**Références :** `cahier-des-charges-pizzeria-v2.md` · `audit pizza.md`  
**Principe directeur :** BDD Prisma = source de vérité métier ; Express = API ; Next.js = UI uniquement.

---

## P0 — Bloquant build & fondations (faire en premier)

Sans P0, `npm run build` échoue et la prod ne peut pas être déployée proprement.

| # | Tâche | Fichiers / zone | Critère done |
|---|--------|-----------------|--------------|
| P0.1 | Supprimer imports serveur → `app.pizzeria.fr/lib/*` | `server/src/lib/sync-lazpizza-catalog.ts`, `sync-menu-formules.ts`, `sync-pizza-modifiers.ts` | `tsc` ne référence plus le front |
| P0.2 | Déplacer ou supprimer catalogue TS côté serveur | Déplacer vers `server/src/catalog/` **ou** seed/sync BDD uniquement | Sync menu ne dépend plus du front |
| P0.3 | Corriger types Prisma menu (filtres `readonly`, `include items`) | `server/src/routes/menu.ts`, `sync-lazpizza-catalog.ts` | Build serveur OK sur menu |
| P0.4 | Corriger création commande POS (`OrderItem` nested create) | `server/src/routes/pos.ts` | POST POS crée commande + lignes |
| P0.5 | Typer `invoices.ts` (param `l`, etc.) | `server/src/routes/invoices.ts` | Plus d’implicit `any` bloquant |
| P0.6 | Corriger build Next — `MenuFormulePanel` null | `app.pizzeria.fr/components/cart/MenuFormulePanel.tsx` | `npm run build:web` passe |
| P0.7 | Corriger autres erreurs TS front listées audit | `AdminShell.tsx`, `modules.ts`, `DriverCourierView.tsx`, `PosOfflineBanner.tsx` | `typecheck` front OK |
| P0.8 | Valider build complet | racine | `npm run build` vert (server + web) |
| P0.9 | Corriger CI `NEXT_PUBLIC_API_URL` (double `/api`) | `.github/workflows/ci.yml` | URL API cohérente avec `apiUrl()` |

**Ordre d’exécution recommandé :** P0.1 → P0.2 → P0.3 → P0.4 → P0.5 → P0.8 → P0.6 → P0.7 → P0.9

---

## P1 — Menu 100 % BDD (cœur métier)

Objectif CDC : plus de catalogue hardcodé comme source de vérité.

| # | Tâche | Modules impactés | Critère done |
|---|--------|------------------|--------------|
| P1.1 | Inventorier tous les usages `menu-catalog.ts` / `LAZ_PIZZA_MENU` | front public, POS, cart, checkout | Liste fichiers + plan remplacement |
| P1.2 | Définir **un contrat API menu canonique** (shape unique) | `server/src/routes/menu.ts`, public menu | Même structure catégories/items/modifiers |
| P1.3 | Public menu 100 % API Prisma | `(public)/menu`, panier, formules | Plus de fallback catalogue TS en prod |
| P1.4 | POS menu 100 % API Prisma | `PosDisplay`, modifiers, tailles | POS = même vérité que public |
| P1.5 | Admin CRUD menu complet (catégories, items, modifiers, `isActive`) | `/admin/menu` | Modif admin → visible partout sans redeploy |
| P1.6 | Snapshots commande (`OrderItem.price`, modifiers figés) | `orders.ts`, `pos.ts`, public orders | Historique correct si prix change |
| P1.7 | Retirer fallback `LAZ_PIZZA_MENU` côté runtime public | routes public + composants | API down = erreur explicite, pas menu fantôme |
| P1.8 | Seed / script sync catalogue initial uniquement (pas runtime) | `server/prisma/seed.ts`, `sync:*` | Catalogue initial en BDD, pas en UI |

---

## P2 — Parité modules opérationnels

Aligner KDS, livreur, admin live sur la même chaîne commande.

| # | Tâche | Zone | Critère done |
|---|--------|------|--------------|
| P2.1 | Unifier statuts commande (source `ops-orders.ts`) | POS, KDS, livreur, suivi | Mêmes labels + transitions |
| P2.2 | KDS : uniquement API + Socket (pas de logique menu locale) | `kitchen/` | Colonnes temps réel fiables |
| P2.3 | Livreur : PIN / accès — décider BDD vs env, documenter | `driver-access.ts`, admin | Choix acté + implémenté |
| P2.4 | Socket singleton : éviter listeners dupliqués | POS, KDS, `AdminLiveProvider` | Pas de double events après navigation |
| P2.5 | CRUD `TimeSlot` admin ou documenter seed-only | `/admin/settings`, checkout créneaux | Créneaux modifiables sans seed manuel |
| P2.6 | Monter `AuditLog` sur routes admin sensibles **ou** retirer du schema | middleware audit, routes admin | Plus d’orphelin schema |
| P2.7 | `PrintJob` : liste API + traçabilité admin (optionnel V1) | admin, POS | Réimpression tracée |

---

## P3 — Modules hors périmètre V1 (CDC §4)

Feature flags déjà en place ; soit UI, soit retrait propre.

| # | Tâche | État actuel | Action |
|---|--------|-------------|--------|
| P3.1 | Réservations | API OK, `ModuleDisabled` | UI minimale **ou** flag permanent |
| P3.2 | WiFi invité | API OK, `ModuleDisabled` | Idem |
| P3.3 | Loyalty | API OK, pas de page | Idem |
| P3.4 | Tables / QR | Hors périmètre CDC | Garder désactivé |
| P3.5 | Shifts / pointage avancé | Partiellement fait | Aligner avec CDC employés/planning |

---

## P4 — Documentation, legacy, prod

| # | Tâche | Fichiers | Critère done |
|---|--------|----------|--------------|
| P4.1 | Régénérer / maintenir Swagger depuis routes Express réelles | `server/src/routes/*` | Doc ≈ 80 %+ surface API |
| P4.2 | Mettre à jour `.firecrawl/api-surface.md` (obsolète) | `.firecrawl/` | Reflète Express actuel |
| P4.3 | Supprimer `guest-orders.ts` (mort) | `app.pizzeria.fr/lib/` | Plus de référence |
| P4.4 | Archiver / exclure `client/` Vite du lint/test root | `package.json`, CI | Scripts root = `app.pizzeria.fr` + `server` |
| P4.5 | Recette Docker + Traefik (VPS) | `deploy/` | Build image + smoke test |
| P4.6 | Tests smoke : commande en ligne, POS, KDS event | `tests/` ou manuel CDC §9 | Checklist recette verte |

---

## P5 — Android SUNMI & phase 0 CDC

| # | Tâche | Zone | Critère done |
|---|--------|------|--------------|
| P5.1 | Valider WebView Chrome ≥ 64 sur V2 réel | phase 0 CDC | Go/no-go documenté — `lib/webview-capability.ts`, `PosWebViewGate`, diagnostics admin |
| P5.2 | APK WebView : impression + pont TPE | `android/` | `SunmiPrinter`, `PaymentTerminal`, `LaZPizzaDevice` |
| P5.3 | Mode dégradé offline POS (IndexedDB → `/pos/sync`) | POS + APK | `offline-queue.ts`, sync au retour réseau, test CDC B5 |

---

## PF — Conformité article 286 CGI (ISCA) — priorité avant prod

| # | Tâche | Zone | Critère done |
|---|--------|------|--------------|
| PF.1 | Tables `Fiscal*` + triggers PostgreSQL inaltérabilité | Prisma + migration | UPDATE/DELETE refusés |
| PF.2 | Émission ticket à l'encaissement + chaînage HMAC | `server/src/lib/fiscal/` | Hooks POS / Stripe / sync |
| PF.3 | Multi-TVA `MenuItem.vatRateBps` | schema + admin menu | Ventilation par taux sur ticket |
| PF.4 | Avoirs `VOID`, JET, clôture Z | API `/api/fiscal/*` | verify-chain OK |
| PF.5 | UI admin fiscal + DUPLICATA sur réimpression | `/admin/fiscal` | Clôture + export |
| PF.6 | Archive exercice figée + dossier conformité | `docs/conformite-article-286-cgi.md` | EC valide attestation |
| PF.7 | Mode dégradé B5 tracé (HL-*, double horodatage) | POS offline + sync | JET OFFLINE_INTEGRATED |

**État juillet 2026 :** PF.1–PF.2–PF.4 (base) implémentés ; PF.3 partiel (champ BDD) ; PF.5–PF.7 à compléter.

---

## P6 — Canaux commande & agrégateurs (après V1 terrain)

Objectif : **toute commande** (site, comptoir, Deliveroo, Uber Eats) → **même KDS** + impression cuisine.

| # | Tâche | Zone | Critère done |
|---|--------|------|--------------|
| P6.1 | Champ `channel` sur `Order` (`WEB` \| `POS` \| `DELIVEROO` \| `UBER_EATS`) | Prisma + API | Badge KDS + stats |
| P6.2 | Webhook / import Deliveroo | `server/src/routes/integrations/` | `order:new` + PrintJob KITCHEN |
| P6.3 | Webhook / import Uber Eats | idem | idem |
| P6.4 | Mapping catalogue agrégateur ↔ `MenuItem` | admin | Prix figés sur `OrderItem` |

**Déjà en place (V1) :**
- Commande site web : Stripe → `CONFIRMED` → `order:new` Socket → KDS temps réel
- `enqueueConfirmedOrderPrints` : ticket cuisine + étiquette → KDS Epson (auto via `useKitchenPrintListener`)
- Reçu client → caisse SUNMI / tablette (`usePosPrintListener`)
- Badge canal KDS : Site web / Comptoir (prêt pour Deliveroo / Uber Eats)

---

## Matrice module × priorité

| Module | P0 | P1 | P2 |
|--------|----|----|-----|
| **API Express** | build, types | menu canonique | audit, print |
| **Landing / public** | TS build | menu API | suivi socket |
| **POS** | pos.ts types | menu API | offline sync |
| **KDS** | — | — | statuts + socket |
| **Livreur** | TS front si bloquant | — | PIN, GPS, confirm |
| **Admin** | TS build | menu CRUD | timeslots, audit |
| **Android** | — | — | P5 |

---

## Règles pour toute nouvelle feature

1. Lire `server/prisma/schema.prisma` avant tout changement données.
2. Pas de catalogue produit en dur dans `app.pizzeria.fr/lib/`.
3. Pas d’import `app.pizzeria.fr` depuis `server/`.
4. Routes métier dans `server/src/routes/`, pas `app/api/` Next (sauf proxy public existant).
5. Prix figés sur `OrderItem` à la validation commande.
6. `client/` (Vite) = interdit pour nouveau code.

---

## Prochaine action immédiate

**P0–P5 implémentés en code** — validation matérielle restante :

1. Installer l'APK debug sur SUNMI V2 réel (`android/README.md`)
2. Remplir la fiche go/no-go (`docs/webview-sunmi-checklist.md`) via diagnostics `/admin/pos`
3. Tester coupure réseau + sync (`docs/smoke-checklist-pizzeria-v1.md` §9)
4. Déployer sur VPS Docker si build vert
