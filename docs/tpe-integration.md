# Intégration TPE — SUNMI Pay + Ingenico (Bluetooth / USB)

**Objectif :** envoyer le montant depuis le POS vers le terminal ; si échec → **mode manuel** (saisie montant sur le TPE).  
**Suivi :** chaque encaissement enregistre `Order.paymentMeta` (provider, transactionId, mode native/manuel) pour stats et facturation.

---

## Architecture

```text
PosPaymentSheet (Next.js)
    ↓ runNativeTerminalPayment()
window.PaymentTerminal (APK android/)
    ↓ TerminalOrchestrator
1. SUNMI_PAY      (intégré V2)
2. INGENICO_USB   (câble OTG)
3. INGENICO_BT    (Bluetooth SPP)
    ↓ si échec / indisponible
Mode manuel (saisie TPE + validation caisse)
    ↓
API POST /orders ou PATCH /encash + paymentMeta
```

---

## Fichiers

| Zone | Fichiers |
|------|----------|
| Android | `android/app/src/main/java/fr/lazpizza/pos/payment/*` |
| Pont JS | `PaymentTerminalBridge.kt` → `window.PaymentTerminal` |
| Next.js | `lib/payment/payment-terminal.ts`, `PosPaymentSheet.tsx` |
| API | `Order.paymentMeta`, `Order.paymentCapturedAt` |
| Types | `lib/payment/payment-meta.ts`, `server/src/lib/payment-meta.ts` |

---

## Activation SUNMI Pay (production)

1. Compte [Sunmi Open Platform](https://developer.sunmi.com/)
2. Dans `android/app/build.gradle.kts` :
   ```kotlin
   implementation("com.sunmi:paylib:…") // version doc Sunmi
   ```
3. Compléter `SunmiPayTerminalProvider.kt` (init SDK + transaction)
4. Rebuild APK : `./gradlew assembleRelease`

---

## Activation Ingenico Bluetooth

1. Appairer le TPE dans **Réglages Android → Bluetooth**
2. Optionnel : MAC fixe dans `build.gradle.kts` :
   ```kotlin
   buildConfigField("String", "TERMINAL_BT_ADDRESS", "\"AA:BB:CC:DD:EE:FF\"")
   ```
3. Auto-détection par nom : `ingenico`, `move`, `desk`, `worldline`, `lane`
4. En prod : remplacer `IngenicoEcrProtocol` par le SDK **Worldline** fourni par la banque

---

## Activation Ingenico USB

1. Câble OTG SUNMI/tablette → TPE
2. Autoriser l’accès USB au premier branchement
3. Finaliser `IngenicoUsbTerminalProvider.kt` avec la doc acquéreur (bulk transfer)

---

## Mode manuel (repli)

- Navigateur tablette **sans APK** → toujours manuel
- APK sans TPE détecté → bascule auto après message d’erreur
- Caissier : montant sur TPE → **« Paiement accepté »** dans le POS

`paymentMeta` enregistré :
```json
{
  "provider": "MANUAL",
  "captureMode": "manual",
  "amountCents": 2950,
  "terminalReference": "POS-173…",
  "capturedAt": "2026-07-08T12:00:00.000Z"
}
```

Mode natif réussi :
```json
{
  "provider": "INGENICO_BT",
  "captureMode": "native",
  "amountCents": 2950,
  "transactionId": "ECR-…",
  "cardBrand": "CONTACTLESS",
  "terminalReference": "POS-173…",
  "capturedAt": "…"
}
```

---

## Base de données

Après pull :
```bash
npm run db:push
npm run db:generate
```

Champs ajoutés sur `Order` :
- `paymentMeta` (JSON)
- `paymentCapturedAt` (DateTime)

---

## Test sans matériel

Dans la WebView POS (Chrome devtools si accessible) :
```javascript
JSON.parse(PaymentTerminal.getCapabilities())
```

Simuler approbation (stub) :
```javascript
const id = PaymentTerminal.startPayment(1500, 'TEST')
PaymentTerminal.simulateApproved(id)
```

---

## Tablette Android (hors SUNMI)

Installer le **même APK** `fr.lazpizza.pos` sur la tablette caisse :
- Ingenico BT/USB prioritaire (pas SUNMI Pay)
- Même URL prod `https://app.pizzeria.fr/pos`

---

*Aucune donnée carte bancaire ne transite par RestaurantOS — conforme CDC V1.*
