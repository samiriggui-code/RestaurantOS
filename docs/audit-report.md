# Rapport d'audit technique — RestaurantOS / La Z Pizza

**Date :** juillet 2026  
**Référence CDC :** `cahier-des-charges-pizzeria-v2.md` §2.2.1  
**Statut :** Audit initial complété — à valider avant mise en production

---

## 1. Périmètre audité

| Zone | Fichiers / outils |
|------|-------------------|
| API Express | `server/src/` — auth JWT, rate limiting, helmet, sanitize |
| Webhooks Stripe | `server/src/routes/payments.ts` — signature `constructEvent` |
| Schéma Prisma | `server/prisma/schema.prisma` — PostgreSQL 16, centimes |
| Dépendances | `npm audit` server + app.pizzeria.fr |
| Secrets | Variables `.env` — pas de clés en dur dans le repo |

---

## 2. Sécurité routes Express

| Contrôle | Résultat |
|----------|----------|
| Auth JWT sur routes staff | ✅ `authenticate` + `requireRole` |
| Routes publiques isolées | ✅ `/api/public/*` sans session staff |
| Rate limiting | ✅ `apiLimiter`, `authLimiter` |
| Helmet + HPP + sanitize XSS | ✅ `server/src/index.ts` |
| Modules désactivés V1 | ✅ `requireModule` → 404 |
| Uploads statiques | ✅ `/api/uploads` — vérifier permissions prod |
| CORS | ✅ Origines configurées + LAN dev |

**Recommandations :**
- Rotations `JWT_SECRET` / `REFRESH_SECRET` documentées en prod
- Désactiver `/api/docs` en production si exposé publiquement

---

## 3. Webhooks Stripe

| Contrôle | Résultat |
|----------|----------|
| Raw body avant JSON parser | ✅ `stripeWebhookRaw` monté avant `express.json()` |
| Vérification signature | ✅ `constructEvent(payload, sig, endpointSecret)` |
| Idempotence statut | ✅ `PENDING_PAYMENT` → `CONFIRMED` uniquement après succès |
| Pas de commande cuisine avant paiement | ✅ KDS/POS filtrent `PENDING_PAYMENT` |

---

## 4. Schéma Prisma

| Contrôle | Résultat |
|----------|----------|
| PostgreSQL (pas SQLite) | ✅ |
| Montants en centimes (`Int`) | ✅ Order, OrderItem, MenuItem |
| Mono-tenant `BUSINESS_ID` | ✅ |
| `PENDING_PAYMENT`, `PrintJob`, `trackingToken` | ✅ |
| Migrations versionnées | ✅ `server/prisma/migrations/` |

---

## 5. npm audit (à exécuter avant livraison)

```bash
cd server && npm audit --audit-level=high
cd app.pizzeria.fr && npm audit --audit-level=high
```

**Action :** corriger toute vulnérabilité **high/critical** avant go-live.  
Relancer l'audit après chaque mise à jour majeure de dépendances.

---

## 6. Conclusion go/no-go code (§2.2.1)

| Critère | Verdict |
|---------|---------|
| Socle exploitable sans refonte | **GO** |
| Stripe webhook sécurisé | **GO** |
| Auth staff conforme CDC (JWT amendé) | **GO** |
| npm audit sans critical | **À valider** (commande ci-dessus) |

**Décision :** poursuite du projet sur socle RestaurantOS adapté — pas de retour « from scratch » v1.0.

---

## 7. Prochaines vérifications

- [ ] `npm audit` sans critical le jour du déploiement
- [ ] Test intrusion basique (routes admin sans token → 401)
- [ ] Webhook Stripe test mode + live
- [ ] WebView SUNMI — voir `docs/webview-sunmi-checklist.md`
