# RestaurantOS — Faisabilité plan URY/Frappe (cartographie 2026-08-24)

> Verdict : **OUI, faisable** comme refactor contrôlé. **NON** comme migration URY/ERPNext.
> URY local = clone cassé — à restaurer avant benchmark code.
>
> **Paiement (décision 2026-08-24) : SumUp partout — plus de Stripe actif.**
>
> **P0 livré (2026-08-24)** — OrderNumberService, enums + state machine, PaymentProvider SumUp branché, RBAC reports/loyalty.

## Verdict exécutif

| Décision                          | Faisable ? | Note repo                                                     |
| --------------------------------- | ---------- | ------------------------------------------------------------- |
| Ne pas migrer vers URY / ERPNext  | ✅         | Express+Prisma+React                                          |
| P0 OrderNumberService + unique DB | ✅ Fait    | `allocateOrderNumber` + `@@unique([businessId, orderNumber])` |
| P0 enums + state machine          | ✅ Fait    | Prisma enums + `lib/order-status.ts`                          |
| P0 PaymentProvider **SumUp only** | ✅ Fait    | guest-checkout + refund via `getPaymentProvider()`            |
| P0 permissions centralisées       | ✅ Fait    | `lib/permissions.ts` + reports/loyalty                        |
| Option B multi-entry              | ✅         | Plus tard                                                     |
| Stock / Recipe                    | ⚠️         | Déjà MenuItemRecipe — UI/polish                               |

## Stack paiement (cible)

```text
getPaymentProvider()
      │
      ▼
PaymentProvider
      └── SumupProvider  ← SEUL provider actif
```

| Fait                                               | Note                                                   |
| -------------------------------------------------- | ------------------------------------------------------ |
| `server/src/lib/payment-provider.ts`               | Contrat SumUp only                                     |
| guest-checkout / refund                            | Passent par `getPaymentProvider()`                     |
| Suppression `StripePayment.tsx` + deps `@stripe/*` | OK                                                     |
| Labels « Stripe (historique) »                     | Colonne `stripePaymentIntentId` = legacy lecture seule |
| Retirer `STRIPE_*` des `.env` locaux / VPS         | Manuel ops                                             |

**Interdit** : réintroduire Stripe ; 2ᵉ PSP hors `PaymentProvider`.

## Preuves P0

| Élément           | Emplacement                                                |
| ----------------- | ---------------------------------------------------------- |
| Numéros atomiques | `lib/order-number.ts` + `FiscalSequence.nextOrderNo`       |
| Migration         | `prisma/migrations/20260824180000_p0_order_number_enums/`  |
| Transitions       | `lib/order-status.ts` + PATCH `/orders/:id/status`         |
| Permissions       | `lib/permissions.ts`                                       |
| Tests             | `tests/order-status.test.ts`, `tests/order-number.test.ts` |

## P1–P5

| Phase     | Contenu (skill URY)                                                                   | Statut                                           |
| --------- | ------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **P1**    | Découpe `orders.ts` + domaine delivery (logique hors monolithe, **URLs API stables**) | ✅ Clos                                          |
| **A**     | Permissions orders (audit 1.4 restant)                                                | ✅ Clos — `ORDERS_*` + routes gated              |
| **B**     | Module DRIVER API (audit 1.7)                                                         | ✅ Clos — `lib/driver-actions` + `/api/driver/*` |
| **C**     | Permissions settings + devices (audit 1.4)                                            | ✅ Clos — `SETTINGS_*` + `DEVICES_*`             |
| **D**     | Permissions licenses + employees (audit 1.4 restant)                                  | ✅ Clos — `LICENSES_*` + `EMPLOYEES_*`           |
| **FE**    | DriverCourierView → `/api/driver/*` + auth PIN                                        | ✅ Clos                                          |
| **E**     | POS avancé — session caisse + fusion de notes (benchmark URY 2026-08-25)              | À faire                                          |
| **F**     | POS avancé — transfert de commande entre tables/serveurs (stretch, dépend de E)       | Plus tard                                        |
| **P2**    | Stock / recettes polish (déjà MenuItemRecipe)                                         | Plus tard                                        |
| **P3**    | Option B multi-entry frontend                                                         | Plus tard                                        |
| **P4–P5** | Selon skill (legacy client, Android)                                                  | Plus tard                                        |

### Mini-spec P1 — **CLOS**

**Objectif :** réduire `routes/orders.ts` en extrayant la logique métier vers `lib/order-*.ts` (et delivery), sans changer les chemins `/api/orders/...`.

**Livré :**

- `order-assign-driver`, `order-cancel`, `order-encash`, `order-pos-settle`, `order-payment-update`, `order-payment-meta`
- `order-update-status`, `order-create`, `order-split`
- Routes = thin wrappers ; URLs stables
- `orders.ts` ~766 lignes (was ~1355)

**Preuve :** `npm run typecheck` OK ; jest P1/orders **38** passed (2026-08-24).

**Hors-scope respecté :** Option B, stock polish, URY.

### Mini-spec A — **CLOS** (permissions orders)

**Objectif :** finir audit 1.4 sur `orders.ts` — plus de routes staff sensibles sans auth ; WAITER sans paiement / PII / reports.

**Livré :**

- `PERMISSION.ORDERS_READ|WRITE|PAYMENT|CANCEL|ASSIGN_DRIVER|CUSTOMER_PII`
- Routes staff gated ; `/active`, `/customer/:phone`, `POST /:id/items` auth + tenant JWT
- Routes publiques stables avant `/:id` : track-token, track, call-waiter
- Split validation `splits` (400 si vide)

**Preuve :** `permissions.test.ts` + `orders.test.ts` + typecheck

**Hors-scope :** settings/devices full table, FE Next.js (migration `/api/driver/*`)

### Mini-spec B — **CLOS** (DRIVER API)

**Objectif :** logique livreur hors monolithe + scoping serveur (un livreur n’agit que sur ses livraisons).

**Livré :**

- `lib/driver-actions.ts` — accept / location / confirm / issue + `assertDriverMayAct`
- `routes/driver.ts` — `POST /api/driver/orders/:id/{accept,location,confirm,issue}` (identité obligatoire)
- Routes publiques track-token → wrappers sur les mêmes libs (`requireIdentity: false` = compat FE actuel)

**Preuve :** `driver-actions.test.ts` + typecheck

**Hors-scope :** migration FE vers `/api/driver/*` (Claude / Next)

### Mini-spec C — **CLOS** (permissions settings/devices)

**Objectif :** finir audit 1.4 sur `settings.ts` + `devices.ts` — plus de lecture paramètres / jumelage staff sans rôle.

**Livré :**

- `SETTINGS_READ|WRITE`, `DEVICES_READ|WRITE|ONBOARDING|PRINT`
- `GET /settings`, `/schedule` → ADMIN/MANAGER ; `PUT` → ADMIN
- `POST /devices/pair` (staff) → ADMIN/MANAGER (était `authenticate` seul)
- Routes CRM devices → `requirePermission` centralisé

**Preuve :** `permissions.test.ts` étendu + typecheck

**Hors-scope :** ~~`licenses.ts`, `employees.ts` tableau complet~~ → voir passe D

### Mini-spec D — **CLOS** (permissions licenses/employees)

**Objectif :** finir audit 1.4 sur `licenses.ts` + routes `employees.ts` sans `requireRole` ad hoc.

**Livré :**

- `LICENSES_READ|WRITE`, `EMPLOYEES_READ|WRITE|ADMIN`, `EMPLOYEES_ATTENDANCE_*`, `EMPLOYEES_PLANNING_*`
- `licenses.ts` : GET → ADMIN/MANAGER ; POST/PUT → ADMIN
- `employees.ts` : CRUD/shifts → permissions centralisées ; pointage KDS ; today-board CHEF+

**Preuve :** `permissions.test.ts` (13 tests) + typecheck

### Mini-spec FE driver — **CLOS**

**Objectif :** migrer `DriverCourierView` vers `/api/driver/orders/:id/*` avec `driverAuthHeaders`.

**Livré :**

- Proxies Next `app/api/driver/orders/[id]/{location,confirm,issue}`
- `driver-api.ts` : `postDriverLocation(orderId)`, `confirmDriverDelivery`, `reportDriverDeliveryIssue`
- Routes publiques track-token conservées (compat legacy)

**Preuve :** `next build` OK

### Mini-spec E — **À FAIRE** (POS avancé : session caisse + fusion de notes)

**Origine :** déploiement de test URY sur VPS (2026-08-25, `ury.gsms-security.com`), comparaison directe CRM/KDS/POS. Verdict : RestaurantOS devant sur CRM (fidélité — URY n'a rien) et KDS (URY = juste un toast de notif, pas d'écran dédié). URY devant sur 2 points POS concrets, à rattraper.

**E.1 — Session de caisse (ouverture/fermeture)**

- Objectif : traçabilité du fond de caisse par service, comme `POSOpeningDialog`/`POSClosingDialog`/`ClosingPaymentTable` côté URY. Aujourd'hui rien n'existe dans `pos.ts` pour ça.
- Ne PAS ajouter de colonne sur `Order` (fiscalement sensible, déjà figé par `assertOrderFiscallyMutable`) — la session est une entité à part, liée par fenêtre temporelle + `cashierId`.
- Prisma : nouveau modèle `PosSession` (`id`, `businessId`, `cashierId`, `openedAt`, `openingCashAmount`, `closedAt DateTime?`, `closingCashAmount Int?`, `expectedCashAmount Int?`, `discrepancy Int?`, `status` — enum `OPEN`/`CLOSED`, `notes String?`).
- Backend : `server/src/lib/pos-session.ts` — `openPosSession` (refuse si une session `OPEN` existe déjà pour ce cashier/business), `closePosSession` (calcule `expectedCashAmount` = somme des commandes `paymentMethod: CASH` payées dans la fenêtre `[openedAt, now]` pour ce business, `discrepancy = closingCashAmount - expectedCashAmount`).
- Routes `pos.ts` : `POST /api/pos/session/open`, `POST /api/pos/session/:id/close`, `GET /api/pos/session/current` — permission `PERMISSION.POS_SESSION` (ADMIN/MANAGER/CASHIER, même pattern que `permissions.ts` existant).
- Frontend : `PosOpeningDialog.tsx` / `PosClosingDialog.tsx` dans `app.pizzeria.fr/components/pos/` — bloque l'accès à `PosDisplay.tsx` tant qu'aucune session n'est ouverte (miroir du flow URY), écart affiché en fin de service.
- Test : `pos-session.test.ts` (pattern `order-p1-core.test.ts` — mock Prisma simple, pas de supertest).

**E.2 — Fusion de notes (bill merge)**

- Objectif : symétrique de `order-split.ts` (qui existe déjà) — regrouper plusieurs commandes ouvertes (même table ou tables différentes en salle) en une seule avant encaissement.
- Backend : `server/src/lib/order-merge.ts` — `mergeOrders(prisma, io, { targetOrderId, sourceOrderIds, businessId })`. Garde-fous identiques à `splitOrder` : refuse si une des commandes est `PAID`/`CANCELLED`/`COMPLETED`. Déplace tous les `OrderItem` des sources vers la cible (`orderItem.updateMany`), recalcule `subtotal/tax/serviceCharge/total` de la cible via `computeOrderTotalsFromLines`, passe les commandes sources en `CANCELLED` (motif `OTHER`, note "Fusionnée dans #<orderNumber cible>") plutôt que de les supprimer — garde l'historique/traçabilité fiscale.
- Route : `POST /api/orders/merge` dans `orders.ts`, `requireRole('ADMIN','MANAGER','CASHIER')` (même garde que `/:id/split`).
- Frontend : `BillMergeDialog.tsx` dans `app.pizzeria.fr/components/pos/` — sélection multi-commandes ouvertes, confirmation, appel API.
- Test : `order-merge.test.ts`, même convention que `order-split.test.ts` (mock Prisma minimal).

**Hors-scope E :** transfert de commande entre tables/serveurs (→ mini-spec F), aggregator selector dans le POS (déjà géré backend via `channel` sur `Order`, pas de gap UI urgent identifié).

**Critère "done" E :** `npm run typecheck` (server + app.pizzeria.fr) OK, tests `pos-session` + `order-merge` verts, URLs `/api/orders/...` et `/api/pos/...` existantes inchangées.

### Mini-spec F — **PLUS TARD** (transfert de commande entre tables/serveurs)

- Objectif : équivalent de `CaptainTransferDialog` côté URY — réassigner une commande ouverte à une autre table et/ou un autre cashier/serveur, sans passer par annulation.
- Backend : `PATCH /api/orders/:id/transfer` dans `orders.ts` → `lib/order-transfer.ts`, body `{ tableId?, cashierId? }`, refuse si commande `PAID`/`CANCELLED`/terminale (mêmes garde-fous que merge/split), libère l'ancienne table si plus aucune commande active, occupe la nouvelle.
- Dépend de E (même famille de garde-fous, même convention de test) — à faire après, pas en parallèle, pour éviter du travail redondant si E fait évoluer les helpers partagés (VAT/totaux/table).
