# Firecrawl — index documentation projet Pizzeria

Ce dossier contient des références locales pour les agents (UI, API, métier).

## Fichiers projet

| Fichier | Contenu |
|---------|---------|
| `project-brief.md` | Synthèse cahier des charges |
| `data-model.md` | Entités Prisma cibles |
| `api-surface.md` | Endpoints API prévus |
| `ui-modules.md` | Écrans et parcours A/B/C/D |
| `sunmi-printer.md` | Pont WebView, SDK impression 58 mm |

## Fichiers UI (registries)

| Fichier | Contenu |
|---------|---------|
| `shadcn-registry.md` | Index composants shadcn/ui |
| `shadcn-namespace.md` | Namespaces registry shadcn |
| `statistic-cards.md` | Blocs ReUI — inspiration dashboard admin |

## Source de vérité

`cahier-des-charges-pizzeria.md` (racine du dépôt)

## URLs utiles à scraper (si besoin)

- Stripe Payment Element : https://docs.stripe.com/payments/payment-element
- Stripe webhooks : https://docs.stripe.com/webhooks
- Next.js SSE : patterns Route Handlers streaming
- SUNMI Printer SDK : documentation officielle InnerPrinter / PrinterX
- schema.org LocalBusiness : https://schema.org/LocalBusiness

## Règles Cursor associées

`.cursor/rules/` — `00-core-project`, `feature-workflow`, `modules-ui`, `sunmi-android`, `stripe-orders`, `deploy-vps`
