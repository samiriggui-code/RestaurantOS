# La Z Pizza — APK WebView (SUNMI / tablette / KDS / livreur)

WebView Android 7.1+ chargeant les modules Next.js avec ponts SUNMI + Epson LAN.

## Flavors Gradle

| Flavor | APK | URL prod |
|--------|-----|----------|
| `posSunmi` | Caisse SUNMI V2 | `https://app.pizzeria.fr/pos` |
| `posTablet` | Tablette caisse | `https://app.pizzeria.fr/pos` |
| `kds` | Écran cuisine | `https://app.pizzeria.fr/kitchen` |
| `livreur` | Tournée livreur | `https://pizzeria.fr/livreur` |

## Build

```bash
cd android

# Release prod (URLs par défaut app.pizzeria.fr)
./gradlew assemblePosSunmiRelease
./gradlew assembleKdsRelease

# Labo gsms-security.com
./gradlew assemblePosSunmiRelease assembleKdsRelease \
  -POPS_HOST=https://pizza-app.gsms-security.com \
  -PPUBLIC_HOST=https://pizza.gsms-security.com

# Ou depuis Windows (racine repo)
.\deploy\scripts\build-sunmi-lab.ps1

# Debug LAN (PC dev sur 192.168.1.10)
./gradlew assemblePosSunmiDebug -PDEV_LAN_URL=http://192.168.1.10:3000
```

APK : `app/build/outputs/apk/<flavor>/<buildType>/`

## Installer sur SUNMI V2 (sans navigateur)

Le SUNMI n'a **pas de Chrome** — l'APK WebView est **obligatoire**.

### Méthode A — USB + ADB (recommandée)

1. SUNMI → **Paramètres → À propos** → appuyer **7 fois** sur « Numéro de build »
2. **Options développeur → Débogage USB** : activé
3. Brancher le câble USB au PC Windows
4. Sur le PC (platform-tools Android) :
   ```bash
   adb devices
   adb install -r app/build/outputs/apk/posSunmi/release/app-posSunmi-release.apk
   ```
5. L'icône **« La Z Pizza — Caisse SUNMI »** apparaît dans le launcher → ouvre directement `/pos`

### Méthode B — sans câble

- **Sunmi Assistant** (logiciel PC Sunmi) → installer l'APK
- Copier l'APK sur clé USB OTG → gestionnaire de fichiers SUNMI → ouvrir → installer
- Envoyer l'APK par email/Telegram → télécharger sur le SUNMI → installer

Au premier lancement : écran **jumelage code 6 chiffres** (CRM) → puis **PIN employé caisse** (ex. 1234).

## Ponts JavaScript

```javascript
// SUNMI intégré (SDK InnerPrinter — bind au démarrage APK)
window.SunmiPrinter.printKitchenTicket(texte)  // ticket cuisine (gras)
window.SunmiPrinter.printReceipt(texte)        // reçu client
window.SunmiPrinter.getPrinterStatus()         // JSON : ok, state, paper, model…
window.SunmiPrinter.playNewOrderSound()

// Epson réseau (IP CRM → port 9100)
JSON.parse(window.EpsonPrinter.printToLan('192.168.1.50', texte, '1'))

// Device info
JSON.parse(window.LaZPizzaDevice.getDeviceInfo())
```

Côté Next.js : `lib/print/sunmi-printer.ts`, `lib/print/epson-lan-print.ts`.

Côté Android : `SunmiPrinterHelper.kt` (SDK `com.sunmi:printerlibrary:1.0.18`, bind `InnerPrinterManager` au `onCreate`) → `PrinterBridge` → `window.SunmiPrinter`.

## Prérequis

- Android Studio / JDK 17
- SUNMI V2 : WebView Chrome ≥ 64
- Stack dev : `npm run dev` (3000 + 3001)

## Sécurité

- Navigation limitée au host autorisé (`ALLOWED_HOST`)
- Pas de données CB sur l'APK — TPE physique indépendant
