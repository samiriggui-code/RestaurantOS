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
| Stock / Recipe                    | ✅ Fait    | P2 — RBAC stock + BOM polish (`7f77adf`)                      |

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
| Retirer `STRIPE_*` des `.env` locaux / VPS         | ✅ Local fait ; VPS au prochain redeploy               |

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
| **E**     | POS avancé — session caisse + fusion de notes (benchmark URY 2026-08-25)              | ✅ Clos — PosSession + merge + gate commande     |
| **F**     | POS avancé — transfert de commande entre tables/serveurs (stretch, dépend de E)       | Plus tard                                        |
| **P2**    | Stock / recettes polish (déjà MenuItemRecipe)                                         | ✅ Clos — RBAC + BOM (`7f77adf`)                 |
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

**Hors-scope respecté :** Option B, URY. (P2 stock livré séparément — `7f77adf`.)

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

### Mini-spec E — **CLOS** (POS avancé : session caisse + fusion de notes)

**Origine :** déploiement de test URY sur VPS (2026-08-25, `ury.gsms-security.com`), comparaison directe CRM/KDS/POS.

**Livré :**

- Prisma `PosSession` + migration `20260825010000_pos_session`
- `lib/pos-session.ts` / `lib/order-merge.ts` + routes `/api/pos/session/*` + `POST /api/orders/merge`
- `PERMISSION.POS_SESSION` (ADMIN/MANAGER/CASHIER)
- FE : dialogs open/close/merge, onglet Session, **gate stricte** `PosCashSessionGate` sur module Commande
- Tests : `pos-session.test.ts` + `order-merge.test.ts`

**Preuve :** typecheck + jest Phase E verts

**Hors-scope E :** transfert (→ F), aggregator selector POS

### Mini-spec P2 — **CLOS** (stock RBAC + recettes BOM)

**Livré (`7f77adf`) :** permissions stock, validation couverture recettes / BOM, polish UX admin stock.

**Preuve :** tests stock + typecheck au ship P2.

### Mini-spec F — **PLUS TARD** (transfert de commande entre tables/serveurs)

- Objectif : équivalent de `CaptainTransferDialog` côté URY — réassigner une commande ouverte à une autre table et/ou un autre cashier/serveur, sans passer par annulation.
- Backend : `PATCH /api/orders/:id/transfer` dans `orders.ts` → `lib/order-transfer.ts`, body `{ tableId?, cashierId? }`, refuse si commande `PAID`/`CANCELLED`/terminale (mêmes garde-fous que merge/split), libère l'ancienne table si plus aucune commande active, occupe la nouvelle.
- Dépend de E (même famille de garde-fous, même convention de test) — à faire après, pas en parallèle, pour éviter du travail redondant si E fait évoluer les helpers partagés (VAT/totaux/table).
