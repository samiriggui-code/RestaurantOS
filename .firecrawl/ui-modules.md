# Modules UI — écrans et parcours

## A — Site public

| Écran | Route | Notes |
|-------|-------|-------|
| Landing | `/` | Hero, photos, horaires, carte, réseaux |
| Menu | `/menu` | Grille catégories, options produit |
| Panier | `/cart` | Persist localStorage |
| Checkout | `/checkout` | Mode, créneau/CP, coordonnées, Stripe |
| Suivi | `/order/[token]` | Timeline statuts SSE |
| Légal | `/mentions-legales`, `/confidentialite`, `/cookies` | RGPD |

**Bandeau** : Ouvert / Fermé (réouverture HH:MM) — API horaires.

## B — POS SUNMI

| Écran | Route | Notes |
|-------|-------|-------|
| Login | `/pos/login` | Employé |
| Grille | `/pos` | Catégories, panier latéral |
| Options | `/pos/product/[id]` | Modales touch |
| Paiement | `/pos/checkout` | Espèces / Carte (TPE externe) |
| File print | `/pos/prints` | Réimpression 24h |

**Natif** : `SunmiPrinter`, son nouvelle commande web.

## C — KDS

| Écran | Route | Notes |
|-------|-------|-------|
| Board | `/kds` | 3 colonnes, plein écran |
| Login | `/kds/login` | Employé |

**UX** : cartes larges, chronomètre, alerte retard, son nouvelle commande.

## D — Back-office

| Écran | Route | Notes |
|-------|-------|-------|
| Dashboard | `/admin` | CA, ticket moyen, top produits |
| Produits | `/admin/products` | CRUD + rupture toggle |
| Catégories | `/admin/categories` | CRUD + ordre |
| Commandes | `/admin/orders` | Filtres, détail, export |
| Paramètres | `/admin/settings` | Horaires, livraison, créneaux, tickets |
| Fermeture | `/admin/settings/closure` | Fermeture exceptionnelle 1 clic |

## Parcours critiques

### Commande en ligne
Menu → Panier → Checkout → Stripe → Webhook → SSE → KDS + V2 print → Statuts → Client suivi

### Commande comptoir
POS grille → Panier → Paiement déclaré → Print immédiat → KDS → Statuts

## Contraintes UX POS/KDS

- Touch targets ≥ 48px
- Pas d'animations lourdes (WebView Android 7.1)
- Contraste élevé cuisine (éclairage variable)
