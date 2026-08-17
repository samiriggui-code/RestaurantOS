
Audit RestaurantOS — cohérence API / Prisma / modules
Audit complet du repo (POS, KDS, CRM, livreur, landing, Android) + builds. Voici le bilan.

Verdict global
Le cœur métier passe bien par PostgreSQL via Prisma : commandes, menu, paiements, livraison, stock, factures, employés/planning, rapports. Les modules POS/KDS/admin communiquent correctement via Socket.io (order:new, order:statusUpdate, print:job).

Mais la dette est réelle : documentation API obsolète, menu public encore couplé à un catalogue TS en dur, builds qui échouent, et plusieurs modèles Prisma partiellement exploités (TimeSlot, AuditLog, Loyalty, etc.).

Carte des modules
Module	URL	Appels API	Persistance BDD
Landing / menu
pizzeria.fr/
Proxy Next /api/public/* → Express
Menu via Prisma + fallback LAZ_PIZZA_MENU
Checkout / suivi
/commander, /suivi/[token]
Prisma Order + Stripe webhook
✅ Commandes archivées
Livreur
/livreur, /livreur/[token]
Prisma Order (GPS, confirm)
✅ Sauf PIN livreur = env, pas BDD
POS
app.pizzeria.fr/pos
Direct Express staffFetch
✅ + file offline IndexedDB → /pos/sync
KDS
/kitchen
GET/PATCH /api/orders
✅
CRM admin
/admin/*
staffFetch sur ~15 namespaces
✅ (sauf stubs UI)
Android SUNMI
WebView → /pos
Ponts natifs print/TPE
✅ sync offline
Temps réel : Socket.io partout (pas de SSE). Admin, POS et KDS partagent le même socket singleton.

Flux commande (cohérent)
POST /api/public/orders
Stripe webhook
order:new
print:job
POST /api/orders
READY delivery
driver-confirm
order:trackUpdate
Landing / Panier
Order PENDING_PAYMENT
CONFIRMED + PrintJob
KDS /kitchen
POS SUNMI
POS comptoir
Livreur /livreur
DELIVERED
Suivi client /suivi
Ce pipeline est aligné entre les vues. Les statuts partagés sont dans app.pizzeria.fr/lib/ops-orders.ts.

Prisma — modèles vs exploitation
Modèle	API	UI	Statut
Order, OrderItem
✅
POS/KDS/admin/suivi/livreur
Complet
MenuCategory, MenuItem, modifiers
✅
admin + POS + public
Complet (double source menu)
User, Shift, EmployeeScheduleEntry
✅
admin employés/planning
Complet (après sync récent)
Invoice, InvoiceLine
✅
/admin/invoices
Complet
StockItem, MenuItemRecipe
✅
/admin/stock
Complet
DeliveryZone
✅
admin + checkout
Complet
PrintJob
PATCH only
Socket push
Partiel — pas de liste API
TimeSlot
GET only
checkout créneaux
Partiel — seed only, pas de CRUD admin
Reservation
✅ routes
ModuleDisabled
API sans UI
WifiQrCode
✅ routes
ModuleDisabled
API sans UI
LoyaltyProgram
✅ routes
aucune page
API sans UI
AuditLog
middleware existe
jamais monté
Orphelin
EmailLog
write-only mail
pas de lecture
Partiel
Expense
✅
admin
⚠️ pas de FK Prisma vers Business
Panier client : localStorage jusqu'au checkout — normal pour une app e-commerce, pas un bug.

Orphelin mort : app.pizzeria.fr/lib/guest-orders.ts (JSONL local) — plus utilisé, tout passe par Express/Prisma.

Documentation API
Source	État
GET /api/docs (Swagger Express)
~7 routes documentées sur ~80+ réelles ; /auth/logout documenté mais absent
.firecrawl/api-surface.md
Obsolète — décrit /api/admin/*, /api/kds/*, SSE /api/events/* qui n'existent pas
Interface API dans l'app
Pas de page docs — seulement DeviceDiagnosticsPanel dans /admin/pos et /admin/kitchen (tests manuels API/socket/print)
Legacy client/ Vite
Ancien frontend avec son propre api.ts — hors prod (Docker/CI ne le build pas)
La doc vivante la plus fiable aujourd'hui : le code dans server/src/routes/*.ts + les proxies app.pizzeria.fr/app/api/public/**.

Builds — résultats
Serveur (npm run build dans server/)
❌ Échec — 14+ erreurs TypeScript :

Import cross-projet app.pizzeria.fr/lib/menu-catalog.ts depuis le serveur (hors rootDir)
Types Prisma readonly incompatibles (menu.ts, sync-lazpizza-catalog.ts)
pos.ts, invoices.ts — types incomplets
Frontend Next (npm run build dans app.pizzeria.fr/)
❌ Échec — bloqué sur :

MenuFormulePanel.tsx:64 — formules possibly null
Typecheck frontend
❌ 6 erreurs supplémentaires : AdminShell.tsx, modules.ts (employees vs users), DriverCourierView.tsx, PosOfflineBanner.tsx

CI
.github/workflows/ci.yml a NEXT_PUBLIC_API_URL: http://localhost:3001/api — double /api possible car apiUrl() ajoute déjà /api.

Top 10 incohérences (par impact)
🔴 Critique
Double source menu — BDD + LAZ_PIZZA_MENU hardcodé ; fallback si API down ; sync serveur importe le catalogue frontend
Build prod cassé — serveur + Next ne compilent pas → dette bloquante pour déploiement propre
Doc API trompeuse — Swagger + .firecrawl/* ne reflètent pas l'API réelle → risque d'intégration incorrecte
🟠 Important
AuditLog jamais branché — archivage actions admin promis en schema mais middleware non monté sur les routes
Menu public ≠ menu POS — /api/public/menu sans modifiers ; POS utilise /api/menu/categories (formes différentes, euros vs centimes)
Modules admin stub — tables, réservations, WiFi, loyalty : API Prisma OK, UI = ModuleDisabled
TimeSlot non administrable — créneaux checkout lus en BDD mais modifiables seulement via seed
🟡 Modéré
PIN livreur en env (driver-access.ts) — pas en BDD, pas rotatable depuis admin
Socket singleton partagé POS/KDS/admin — risque listeners dupliqués si navigation sans reset
Legacy client/ Vite — scripts root lint/test pointent encore dessus, pas app.pizzeria.fr
Ce qui communique bien ✅
Commandes : landing → Stripe → KDS → POS print → livreur → suivi client (mêmes events socket)
Staff auth : PIN + JWT, même session pour POS/KDS/admin
Offline POS : IndexedDB → replay Prisma via /pos/sync
Android : bridges SunmiPrinter + PaymentTerminal alignés avec le code Next
Admin live : AdminLiveProvider écoute les mêmes events que KDS/POS
Employés/planning : maintenant bien en Prisma (Shift slug, settings.planning)
Recommandations priorisées
Priorité	Action	Effort
P0
Fixer builds TS (serveur + Next)
1–2h
P0
Corriger NEXT_PUBLIC_API_URL CI (/api en double)
5 min
P1
Menu 100 % BDD — retirer fallback LAZ_PIZZA_MENU côté public
2–4h
P1
Monter logAction sur routes admin sensibles OU supprimer AuditLog
1h
P1
Régénérer Swagger depuis routes Express réelles
2–3h
P2
CRUD TimeSlot admin ou documenter seed-only
2h
P2
UI réservations / WiFi / loyalty ou retirer des flags modules
variable
P2
Supprimer guest-orders.ts + mettre à jour .firecrawl/api-surface.md
1h
P3
Archiver/supprimer client/ Vite legacy
1h
Réponse directe à ta question
« Tout doit passer par la BD pour archivage et maintien de l'app »

Pour les commandes, le menu admin, les employés, la facturation, le stock, la livraison : oui, c'est le cas.

Exceptions notables :

Panier = localStorage (normal)
File offline POS = IndexedDB temporaire → sync BDD
Catalogue public = hybride BDD + TS hardcodé ← principal point faible
PIN livreur = variable d'environnement
Audit actions admin = schema Prisma mais pas branché
Doc API = pas entretenue (Swagger ~10 % de la surface réelle)
L'interface la plus proche d'une « doc API » dans l'app d'origine est le DeviceDiagnosticsPanel (tests live), pas une référence Swagger intégrée au CRM.