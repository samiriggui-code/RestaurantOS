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

Découpe `orders.ts`, domaine delivery, stock polish, Option B — inchangés.
