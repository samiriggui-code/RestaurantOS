# SUNMI V2 — intégration impression (référence agent)

> Appareil : SUNMI V2, Android 7.1, imprimante thermique 58 mm intégrée, WebView pour UI POS.

## Architecture

```
Serveur Next.js (POS web)  ←→  APK Android (WebView)
                                    ↓
                            @JavascriptInterface
                                    ↓
                         SUNMI InnerPrinter / PrinterX
```

## Pont JavaScript (côté web POS)

```javascript
// Disponible uniquement dans l'APK SUNMI
if (window.SunmiPrinter) {
  window.SunmiPrinter.printKitchenTicket(JSON.stringify(payload));
  window.SunmiPrinter.printReceipt(JSON.stringify(payload));
  const status = window.SunmiPrinter.getPrinterStatus(); // paper, cover
  window.SunmiPrinter.playNewOrderSound();
}
```

## Payload ticket cuisine (exemple)

```json
{
  "orderNumber": "042",
  "origin": "ONLINE",
  "slotAt": "19:30",
  "items": [
    { "name": "Margherita", "qty": 2, "options": ["Grande", "Sans oignon"] }
  ],
  "instructions": "Sonner au 3e"
}
```

## Payload reçu client

```json
{
  "shopName": "Pizzeria du Centre",
  "siret": "12345678900012",
  "orderNumber": "042",
  "items": [{ "name": "Margherita", "qty": 2, "unitPrice": 12.5, "lineTotal": 25 }],
  "subtotalHt": 22.73,
  "taxAmount": 2.27,
  "totalTtc": 25,
  "paymentMethod": "CASH",
  "trackingUrl": "https://example.com/order/abc123"
}
```

## Côté Android (Kotlin/Java)

- `WebView` + `addJavascriptInterface(PrinterBridge(), "SunmiPrinter")`
- Verrouiller navigation sur `https://{fqdn-client}/pos/*`
- SDK : `com.sunmi:printerlibrary` ou PrinterX selon version firmware
- QR code sur reçu : lib SUNMI ou bitmap généré côté natif

## Offline

- Commandes comptoir : queue IndexedDB → `POST /api/pos/sync`
- Impression locale sans réseau (données déjà en mémoire)
- Reconnexion Wi-Fi / 4G automatique

## Tests recette

- Impression < 5 s après réception commande
- Son 95 dB sur commande web
- Erreur papier/capot affichée POS
- Réimpression dernières 24 h

## Compatibilité WebView 7.1

- Éviter : optional chaining non polyfillé, CSS `gap` grid ancien, fetch sans fallback
- Préférer : flexbox, boutons larges, polices système, bundle ES5/ES2017
