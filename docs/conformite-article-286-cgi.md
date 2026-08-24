# Conformité article 286 CGI — RestaurantOS / La Z Pizza

Référence : BOFiP BOI-TVA-DECLA-30-10-30 (attestation logiciel de caisse).

**Logiciel :** RestaurantOS — version `FISCAL_SOFTWARE_VERSION` (défaut `1.0.0`).

---

## 1. Critères ISCA implémentés

### Inaltérabilité

- **Figement** à l'encaissement : `paymentStatus → PAID` (POS, webhook SumUp, resync offline).
- Table **`FiscalTicket`** : snapshot complet (lignes, TVA, remises, opérateur, mode paiement).
- **Triggers PostgreSQL** : `UPDATE`/`DELETE` interdits sur `FiscalTicket`, `FiscalClosure`, `FiscalEvent`, `FiscalArchive`.
- **Corrections** : ticket `VOID` négatif via `POST /api/fiscal/void` (motif + opérateur obligatoires).
- **Numérotation** : `FiscalSequence.nextTicketNo` avec verrou transactionnel (`SELECT … FOR UPDATE` via transaction Prisma).

### Sécurisation

- Chaînage **HMAC-SHA256** (`FISCAL_HMAC_SECRET` ou `JWT_SECRET`).
- Chaque ticket inclut `previousHash` + `recordHash`.
- Horodatage **serveur** (`issuedAt`) ; mode dégradé : `offlineSoldAt` + `offlineRef`.
- Vérification : `npm run fiscal:verify-chain --prefix server` ou `GET /api/fiscal/verify`.

### Conservation

- **Clôture Z** : `POST /api/fiscal/closures/daily` — CA par paiement, TVA par taux, nb tickets.
- **Grand total perpétuel** : `FiscalSequence.grandTotalCents` (jamais remis à zéro).
- Clôtures M/Y : à étendre (agrégation des Z).

### Archivage

- Table **`FiscalArchive`** — export figé par exercice + `contentHash`.
- Script export annuel : **à implémenter** (PF.6).
- Conservation **6 ans** ; purge RGPD 3 ans sur données perso uniquement (pas les tickets).

---

## 2. Journal des événements (JET)

Table **`FiscalEvent`** chaînée :

| Type                 | Déclencheur                 |
| -------------------- | --------------------------- |
| `TICKET_ISSUED`      | Encaissement                |
| `TICKET_VOID`        | Avoir                       |
| `REPRINT`            | Réimpression (DUPLICATA)    |
| `OFFLINE_INTEGRATED` | Resync `POST /api/pos/sync` |
| `CLOSURE_DAILY`      | Clôture Z                   |

`PrintJob` → à relier explicitement à `REPRINT` (PF.5).

---

## 3. Mode dégradé (CDC B5)

| Phase         | Comportement                                                          |
| ------------- | --------------------------------------------------------------------- |
| Vente offline | Ticket imprimé **PROVISOIRE** · ref locale `HL-*`                     |
| Resync        | `FiscalTicket` avec `offlineRef`, `offlineSoldAt`, `issuedAt` serveur |
| JET           | `OFFLINE_INTEGRATED`                                                  |

Payload sync : champ optionnel `offlineSoldAt` (ISO 8601).

---

## 4. Multi-TVA

- `MenuItem.vatRateBps` : `1000` = 10 %, `550` = 5,5 %, `2000` = 20 %.
- Ventilation `taxByRate` sur chaque ticket.
- Admin menu : édition taux **à compléter** (PF.3).

---

## 5. Mode formation

- `Business.settings.fiscalTrainingMode = true`
- Tickets `kind = TRAINING` — exclus des clôtures Z.

---

## 6. API fiscal (staff ADMIN/MANAGER)

| Méthode | Route                         | Rôle                            |
| ------- | ----------------------------- | ------------------------------- |
| GET     | `/api/fiscal/verify`          | Vérifier chaînes                |
| GET     | `/api/fiscal/tickets`         | Liste tickets                   |
| GET     | `/api/fiscal/events`          | JET                             |
| GET     | `/api/fiscal/sequence`        | Grand total + prochain n°       |
| POST    | `/api/fiscal/closures/daily`  | Clôture Z                       |
| POST    | `/api/fiscal/void`            | Avoir                           |
| GET     | `/api/fiscal/closure-status`  | Rappel clôture Z (Europe/Paris) |
| GET     | `/api/fiscal/print/journal`   | Export HTML journal             |
| POST    | `/api/fiscal/archives/yearly` | Archive exercice                |
| POST    | `/api/fiscal/reprint`         | Journal DUPLICATA               |

---

## 7. Procédure contrôle

1. Exécuter `npm run fiscal:verify-chain --prefix server`.
2. Exporter tickets + clôtures + JET de la période.
3. Présenter attestation (`docs/attestation-logiciel-caisse-bofip.md`) + checklist remise client.
4. **Relecture expert-comptable** obligatoire avant signature client.

---

## 8. État PF.5–PF.7 (juillet 2026)

- [x] UI `/admin/fiscal` (consultation, clôture, export, guide gérant)
- [x] Hash court sur ticket imprimé SUNMI
- [x] Export archive annuelle signée (hash)
- [x] Avoir automatique à l'annulation
- [x] Garde-fou commandes fiscalisées
- [x] Ticket fiscal bloquant (POS / encaissement)
- [x] Clôture Z Europe/Paris + rappel + auto 23h55
- [x] JET : SOFTWARE_START, OPERATOR_LOGIN, PRICE_CHANGE, TRAINING_MODE
- [x] Reçu fiscal email commandes web
- [x] Modèle attestation `docs/attestation-logiciel-caisse-bofip.md`
- [ ] Clôtures mensuelle / annuelle (agrégation Z)
- [ ] Rôle DB `pizzeria_app` sans UPDATE tables fiscales
- [ ] Certification NF525 tierce partie

---

_Dernière mise à jour : juillet 2026 — P0 fiscal livrés._
