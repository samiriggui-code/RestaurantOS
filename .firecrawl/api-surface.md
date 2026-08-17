# Surface API — Pizzeria

Convention réelle observée :
- public : souvent `{ success, ... }` ou `{ success, error }`
- staff/admin : JSON direct métier ou `{ error }`
- temps réel : **Socket.io**, pas SSE

## `GET /api/health`

Monitoring simple de l'API Express.

## `api/public/` — sans auth

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/api/public/menu` | Catalogue actif Prisma |
| GET | `/api/public/hours` | Horaires + statut ouvert/fermé |
| GET | `/api/public/time-slots` | Créneaux click & collect |
| GET | `/api/public/formules` | Formules pizza + boisson / dessert |
| GET | `/api/public/delivery/quote` | Devis livraison |
| GET | `/api/public/delivery/stops` | Tournée livreur active |
| GET | `/api/public/delivery/day-recap` | Récap journée livreur |
| POST | `/api/public/delivery/verify-pin` | Validation PIN livreur |
| POST | `/api/public/orders` | Création commande online |
| POST | `/api/public/orders/confirm` | Confirmation retour checkout |
| GET | `/api/public/orders/track-token/:token` | Suivi client |
| GET | `/api/public/orders/track-token/:token/driver` | Vue livreur d'une commande |
| POST | `/api/public/orders/track-token/:token/driver-confirm` | Confirmation remise client |
| POST | `/api/public/orders/track-token/:token/driver-issue` | Incident livraison |
| POST | `/api/public/orders/track-token/:token/driver-location` | Position GPS livreur |
| POST | `/api/public/orders/track-token/:token/feedback` | Note client |
| POST | `/api/public/payments/create-intent` | PaymentIntent Stripe |
| POST | `/api/public/payments/webhook` | Webhook Stripe signé |

## `api/auth/` — auth staff

| Méthode | Route | Rôle |
|---------|-------|------|
| POST | `/api/auth/login` | Login staff JWT |
| POST | `/api/auth/refresh` | Refresh token |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Session courante |

## `api/menu/` — staff / POS

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/api/menu/categories` | Catalogue complet POS/staff |
| GET | `/api/menu/categories/manage` | Vue CRM menu |
| POST | `/api/menu/categories` | Créer catégorie |
| PATCH | `/api/menu/categories/:id` | Modifier catégorie |
| POST | `/api/menu/items` | Créer produit |
| PATCH | `/api/menu/items/:id` | Modifier produit |
| POST | `/api/menu/items/:id/image` | Upload image |
| POST | `/api/menu/sync` | Resync catalogue seed |

## `api/orders/` — staff / POS / KDS

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/api/orders` | Liste + filtres |
| POST | `/api/orders` | Commande staff/comptoir |
| PATCH | `/api/orders/:id/status` | Changement statut |
| PATCH | `/api/orders/:id/encash` | Encaissement comptoir |
| PATCH | `/api/orders/:id/pos-settle` | Paiement/remise POS |
| PATCH | `/api/orders/:orderId/items/:itemId/status` | Statut ligne KDS |
| PATCH | `/api/orders/:id/payment` | Mise à jour paiement |
| PATCH | `/api/orders/:id/cancel` | Annulation |
| POST | `/api/orders/:id/items` | Ajouter lignes |
| POST | `/api/orders/:id/print` | Créer PrintJob |
| POST | `/api/orders/:id/split` | Fractionner ticket |

## `api/print-jobs/` — impression

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/api/print-jobs` | File récente d'impression |
| PATCH | `/api/print-jobs/:id` | ACK SUNMI / navigateur |

## `api/settings/` — admin

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/api/settings` | Réglages business |
| PUT | `/api/settings` | Mise à jour business/settings JSON |
| GET | `/api/settings/public` | Infos publiques business |
| GET | `/api/settings/public/:id` | Infos publiques par business |
| GET | `/api/settings/schedule` | Horaires + fermetures + time slots |
| PUT | `/api/settings/schedule` | Mise à jour horaires + time slots |

## `api/employees/` — staff/admin

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/api/employees` | Liste employés |
| GET | `/api/employees/shifts` | Créneaux équipe |
| POST | `/api/employees/shifts` | Créer créneau |
| PUT | `/api/employees/shifts/:id` | Modifier créneau |
| DELETE | `/api/employees/shifts/:id` | Supprimer créneau |
| POST | `/api/employees/shifts/sync` | Recréer créneaux La Z |
| GET | `/api/employees/schedule` | Planning équipe |

## Modules optionnels conservés

| Préfixe | Statut |
|--------|--------|
| `/api/reservations` | API conservée, UI V1 désactivée |
| `/api/wifi` | API conservée, UI V1 désactivée |
| `/api/loyalty` | API conservée, UI V1 désactivée |
| `/api/tables` | API conservée, UI V1 désactivée |

## Temps réel

Socket.io côté serveur :
- `order:new`
- `order:onlinePending`
- `order:paymentUpdate`
- `order:statusUpdate`
- `order:cancelled`
- `order:itemStatusUpdate`
- `kitchen:itemUpdated`
- `kitchen:itemsAdded`
- `print:job`
- `admin:live`
