# shadcn/ui — usage dans ce projet

## Setup

1. Initialiser shadcn dans le projet Next.js racine : `npx shadcn@latest init`
2. Composants dans `components/ui/`
3. Registry docs locales : `.firecrawl/shadcn-registry.md`

## Modules et composants suggérés

| Module | Composants utiles |
|--------|-------------------|
| Site public (A) | `button`, `card`, `badge`, `sheet` (panier), `dialog`, `form`, `input`, `select` |
| POS (B) | `button` (large touch), `scroll-area`, `separator`, `toast` |
| KDS (C) | `card`, `badge`, `button` — UI custom colonnes, peu de chrome |
| Back-office (D) | `data-table`, `form`, `dialog`, `dropdown-menu`, `chart` (dashboard) |

## Prompts exemples

- Add a product card grid for the public menu using shadcn `card` and `badge`
- Create admin product form with shadcn `form` + zod validation
- Build KDS order card with large touch targets (min 48px)
- Add statistic cards to admin dashboard (see `.firecrawl/statistic-cards.md` for ReUI inspiration)

## MCP

Activer le serveur MCP shadcn dans les settings Cursor si disponible.

Exemples :
- Show me hero blocks from @shadcnblocks for the pizzeria landing
- Add a responsive navbar to `app/(public)/layout.tsx`
