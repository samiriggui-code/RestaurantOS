# Checklist WebView SUNMI V2 — Phase 0 (§2.2.2)

**Condition CDC :** WebView Chrome **≥ 64** pour exécuter Next.js POS.  
**Appareil :** SUNMI V2 du client — test sur matériel réel obligatoire.

---

## Procédure (5 min)

1. Ouvrir l'APK POS ou Chrome sur le V2
2. Naviguer vers : `https://app.pizzeria.fr/pos` (ou IP dev HTTPS)
3. Dans la barre d'adresse, si possible, ou via une page test :

```javascript
// Coller dans la console WebView (si accessible) ou page /admin/pos diagnostics
JSON.stringify({
  userAgent: navigator.userAgent,
  chromeVersion: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1],
  secureContext: window.isSecureContext,
})
```

4. Alternative sans console : page admin `/admin/pos` → **Diagnostics** affiche Chrome, décision GO/NO-GO et bouton « Copier rapport go/no-go ».

---

## Grille de décision

| Version Chrome/WebView | Décision |
|------------------------|----------|
| **≥ 64** | **GO POS** — Next.js POS utilisable |
| 58–63 | **NO-GO POS** — mettre à jour Android System WebView (Play Store) |
| < 58 (Android 7.1 usine) | **NO-GO POS** — remplacement V2 ou appareil secours |

---

## Fiche à remplir sur site

| Champ | Valeur |
|-------|--------|
| Date du test | |
| Modèle SUNMI | V2 / V2s / autre |
| Version Android | |
| Version WebView / Chrome | |
| Next.js POS charge ? | Oui / Non |
| Impression SUNMI OK ? | Oui / Non |
| Testeur | |
| Décision | GO / NO-GO POS |

---

## Si NO-GO POS

Le reste du projet **peut continuer** :
- Site public `pizzeria.fr`
- KDS sur tablette récente (Chrome ≥ 64)
- Back-office admin
- App livreur sur téléphone

Seul le **POS WebView sur ce V2** est bloqué jusqu'à résolution matérielle.

---

## Références

- `android/README.md` — build APK, `window.SunmiPrinter`
- CDC v2.2 §2.2.2, §7 compatibilité SUNMI
