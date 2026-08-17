Generate a complete feature for this pizzeria project (single-tenant, socle RestaurantOS).

Context:
- Monorepo: `server/` (Express API) + `app.pizzeria.fr/` (Next.js UI)
- UI route groups: `(public)/`, `(pos)/`, `(kds)/`, `(admin)/`
- Prisma: `server/prisma/schema.prisma`
- Business reference: `cahier-des-charges-pizzeria-v2.md`
- **Do NOT use Vite or `client/`** — all UI in `app.pizzeria.fr/`

Must include (when relevant):
- database impact on `server/prisma/schema.prisma`
- Express routes in `server/src/routes/`
- Socket.io emit if order/status/catalog changes
- Next.js pages/components in the correct route group under `app.pizzeria.fr/`
- PrintJob if printing involved

Strict constraints:
- **Step 0**: Read `server/prisma/schema.prisma` (see `.cursor/rules/feature-workflow.mdc`)
- API stays in Express — never rewrite as Next.js `app/api/` routes
- Online orders: Stripe webhook on Express before `CONFIRMED`
- POS: no card data ; cash/card declared only (external TPE)
- SUNMI: Client Components, WebView Android 7.1, `window.SunmiPrinter`
- Real-time: Socket.io (not SSE) ; < 3s KDS/V2 after payment
- Auth: JWT Express (not Auth.js) ; roles admin/employé
- Single tenant via `BUSINESS_ID` env
- Prod: Traefik labels (not Caddy) ; local: Laragon

Output format:
1) Goal and scope (module A/B/C/D)
2) Implementation plan by steps
3) Files created/updated (`server/` vs `app.pizzeria.fr/`)
4) Environment changes (if any)
5) Validation steps (lint/typecheck/manual + SUNMI if POS)
6) Recette criteria touched (cahier v2 §9)

Production-ready only.
