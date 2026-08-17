# Smoke Checklist — Pizzeria V1

Objectif : valider rapidement la chaîne critique après build ou déploiement.

## Pré-requis

- API Express démarrée
- Front Next.js démarré
- Base Prisma seedée
- Stripe webhook/dev listener actif si test paiement
- Un compte staff admin valide

## 1. Commande en ligne

1. Ouvrir `/menu`
2. Ajouter une pizza au panier
3. Vérifier :
   - prix cohérent
   - upsell/menu boisson visible si applicable
   - checkout propose bien un créneau
4. Finaliser une commande online
5. Vérifier côté API/BDD :
   - commande créée
   - `trackingToken` présent
   - statut initial cohérent (`PENDING_PAYMENT` ou flux comptoir online)

## 2. Paiement / webhook Stripe

1. Simuler le paiement online
2. Vérifier :
   - webhook reçu
   - commande passe à `CONFIRMED`
   - event Socket émis
   - `PrintJob` créé

## 3. POS comptoir

1. Ouvrir `/pos`
2. Créer une commande comptoir
3. Vérifier :
   - menu chargé depuis API
   - commande créée en BDD
   - statut `CONFIRMED`
   - impression demandée (`PrintJob`)
   - la commande apparaît côté KDS

## 4. KDS

1. Ouvrir `/kitchen`
2. Vérifier réception temps réel d'une nouvelle commande **en ligne** (après paiement Stripe)
3. Vérifier badge **Site web** sur la carte commande
4. Vérifier impression auto ticket cuisine (Epson KDS) à la confirmation
5. Faire les transitions :
   - `CONFIRMED` → `PREPARING`
   - `PREPARING` → `READY`
4. Pour une livraison :
   - `READY` → `OUT_FOR_DELIVERY`
5. Vérifier propagation :
   - admin live
   - suivi client
   - queues POS si concerné

## 5. Livreur

1. Ouvrir `/livreur`
2. Vérifier le PIN d'accès
3. Vérifier :
   - tournée chargée
   - recap journée OK
   - une commande `READY` devient visible
4. Confirmer la livraison avec code client
5. Vérifier statut final `DELIVERED`

## 6. Admin

1. Ouvrir `/admin/settings`
2. Modifier un champ business simple
3. Vérifier sauvegarde OK
4. Ouvrir `/admin/pos`
5. Vérifier :
   - diagnostics
   - file `PrintJob`
6. Ouvrir `/admin/shifts`
7. Vérifier séparation :
   - planning équipe
   - créneaux équipe

## 7. Time slots

1. Ouvrir `/admin/settings`
2. Modifier un `TimeSlot`
3. Revenir au checkout
4. Vérifier impact réel sur les créneaux proposés

## 8. Modules hors V1

Vérifier que ces routes admin affichent un état désactivé propre :

- `/admin/reservations`
- `/admin/wifi`
- `/admin/loyalty`
- `/admin/tables`

## 9. POS SUNMI — WebView & hors-ligne (P5)

1. Ouvrir `/admin/pos` sur l'APK ou le navigateur POS
2. Vérifier le bloc **WebView — phase 0 go/no-go** :
   - Chrome ≥ 64 → décision **GO**
   - copier le rapport JSON pour la fiche `docs/webview-sunmi-checklist.md`
3. Tester les ponts :
   - `window.SunmiPrinter` (ticket cuisine)
   - `window.PaymentTerminal` (mode natif ou manuel)
4. Couper le réseau Wi-Fi sur le V2 (page POS déjà ouverte)
5. Créer une commande comptoir espèces
6. Vérifier :
   - ticket imprimé localement
   - bannière hors-ligne visible
   - file IndexedDB > 0 (diagnostics admin)
7. Rétablir le réseau
8. Vérifier sync `POST /api/pos/sync` :
   - bannière disparaît
   - commande en BDD avec marqueur `[offline:…]`
   - KDS reçoit la commande

## Done

Checklist validée si :

- build vert
- commande online OK
- POS OK
- KDS temps réel OK
- livreur OK
- PrintJob traçable
- settings/time slots persistés
- WebView SUNMI ≥ 64 documenté (GO) ou NO-GO tracé
- sync hors-ligne POS validée
