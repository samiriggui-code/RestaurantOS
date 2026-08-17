# Modèle de données — Pizzeria

## Enums

### OrderStatus
`PENDING_PAYMENT` | `CONFIRMED` | `PREPARING` | `READY` | `COMPLETED` | `CANCELLED`

### OrderOrigin
`ONLINE` | `COUNTER`

### OrderMode
`DINE_IN` | `TAKEAWAY` | `DELIVERY`

### PaymentMethod (déclaré)
`CASH` | `CARD` | `STRIPE_ONLINE`

### PrintJobType
`KITCHEN` | `RECEIPT`

### PrintJobStatus
`PENDING` | `PRINTED` | `FAILED`

### UserRole
`ADMIN` | `EMPLOYEE`

## Modèles principaux

### Category
- name, slug, sortOrder, isActive
- products[]

### Product
- categoryId, name, description, price, imageUrl, allergens[]
- isActive (rupture → masqué immédiat)
- optionGroups[]

### OptionGroup
- productId, name, minSelect, maxSelect, required
- options[]

### Option
- optionGroupId, name, priceDelta, isActive

### Order
- orderNumber (affichage), origin, mode, status
- customerId?, guestName, guestPhone, guestEmail?, deliveryAddress?
- slotAt? (créneau click & collect)
- paymentMethod, stripePaymentIntentId?
- subtotalHt, taxAmount, totalTtc
- instructions?, trackingToken (suivi public)
- items[], printJobs[]

### OrderItem
- orderId, productId, productName (snapshot)
- quantity, unitPrice, lineTotal
- optionsSnapshot (JSON — options choisies + prix figés)

### Customer
- name, phone, email?, addresses[]

### User (staff)
- email, passwordHash, role, name

### PrintJob
- orderId, type, status, payload (JSON gabarit), printedAt?, error?

### Setting (clé/valeur ou JSON)
- openingHours, exceptionalClosure
- deliveryZones (postal codes + fee)
- slotCapacity (max orders per slot)
- ticketHeader, ticketFooter, logoUrl
- siret, vatRate, shopName, shopAddress

## Relations clés

- Product désactivé → exclu des requêtes `public` et `pos`
- Order CONFIRMED → émet SSE + crée PrintJob KITCHEN pour V2
- Changement statut KDS → propage vers suivi client (token)

## Index suggérés

- Order: status, createdAt, trackingToken, stripePaymentIntentId
- Product: categoryId, isActive
- PrintJob: orderId, status, createdAt
