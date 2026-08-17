# Roadmap V2 — CRM La Z Pizza

> Vision : offrir à une PME pizzeria les outils des grands acteurs (POS, KDS, stock, facturation, alertes) sans le coût Wix/Deliveroo/Toast — **métier-first**, pas CMS généraliste.

---

## 1. Facturation électronique (France)

### Calendrier officiel (DGFiP / impots.gouv.fr)

| Taille | Réception factures e | Émission factures e |
|--------|---------------------|---------------------|
| **Toutes entreprises** | **1er sept. 2026** | — |
| Grandes entreprises & ETI | 1er sept. 2026 | 1er sept. 2026 |
| **PME, TPE, micro-entreprises** | 1er sept. 2026 | **1er sept. 2027** |

Sources : [impots.gouv.fr](https://www.impots.gouv.fr/depliant-la-facturation-electronique-en-4-questions), [economie.gouv.fr](https://www.economie.gouv.fr/cedef/fiches-pratiques/la-facturation-electronique-entre-entreprises), fiche TPE DGFiP PDF.

### Ce que ça implique pour La Z Pizza (TPE/PME)

1. **Dès sept. 2026** : choisir une **plateforme agréée (PDP/PA)** pour **recevoir** les factures fournisseurs.
2. **Dès sept. 2027** : **émettre** en format électronique structuré (Factur-X, UBL…) via cette plateforme pour les clients **professionnels assujettis TVA** (B2B domestique).
3. **B2C (particuliers)** : pas d’obligation d’e-facture structurée — **ticket / facture PDF ou papier** reste valable ; **e-reporting** des données de transaction selon cas.
4. **Facture à la demande** (client ou organisme) : modèle CRM V2 — numérotation, mentions légales, export PDF, envoi email ; branchement PDP en **phase 3** (sept. 2027).

### Mentions obligatoires facture FR (rappel)

- Identité vendeur : dénomination, adresse, SIRET, N° TVA si assujetti
- Identité client (B2B) : raison sociale, adresse, SIRET/TVA client
- Numéro facture chronologique, date, désignation, quantités, prix HT/TTC, taux TVA
- Conditions de paiement, pénalités de retard (B2B)

### Phases produit facturation

| Phase | Période | Livrable |
|-------|---------|----------|
| **V2.1** | Maintenant | CRM factures manuelles, template La Z Pizza, PDF/HTML email, lien commande |
| **V2.2** | Q2 2026 | Export Factur-X minimal, annuaire SIRET client, archivage |
| **V2.3** | Sept. 2026 | Réception via PDP partenaire (webhook) |
| **V2.4** | Sept. 2027 | Émission B2B via PDP + e-reporting |

---

## 2. Gestion stock par ingrédients (BOM)

### Modèle cible

```
StockItem (fromage mozzarella, carton pizza M, Coca 33cl…)
    ↑
MenuItemRecipe (quantité par vente : 0.05 kg fromage, 1 carton…)
    ↑
MenuItem (Pizza 4 Fromages, Menu Enfant…)
```

### Règles métier

- À la **confirmation commande** (`CONFIRMED`) : déduction automatique selon recettes + lien direct `StockItem.menuItemId` (boissons, emballages 1:1).
- **Seuil `reorderAt`** : alerte admin (email + badge CRM) si `quantity <= reorderAt`.
- **Mouvements** : traçabilité `IN | OUT | WASTE | ADJUST` + référence commande.
- **Annulation commande** : restauration stock (déjà partiellement implémenté).

### Catégories stock

Fromages, Viandes, Légumes, Bases, Pâte, Boissons, Emballage, Hygiène, Divers.

---

## 3. Service email (React Email + Nodemailer)

### Infrastructure

- **Dev** : Mailpit Laragon (`EMAIL_SERVER_HOST=127.0.0.1`, port 1025)
- **Prod** : SMTP (OVH, Brevo, SendGrid…) via variables `EMAIL_*`
- **Templates** : `@react-email/components` dans `server/src/emails/`

### Templates prévus

| Template | Destinataire | Déclencheur |
|----------|--------------|-------------|
| `order-confirmation` | Client | Paiement Stripe OK / commande comptoir email |
| `order-ready` | Client | Statut READY |
| `delivery-handover` | Client | Code livraison |
| `invoice` | Client / organisme | Demande facture CRM |
| `stock-alert` | Admin | Seuil stock bas |
| `admin-incident` | Admin | Panne KDS, imprimante, livraison bloquée |
| `daily-report` | Admin | Rapport CA J/H/M (option cron) |

Variables communes : logo La Z Pizza, adresse Fargues, SIRET depuis `Business.settings`.

---

## 4. Planning employés

### Existant

- **Shifts** : créneaux récurrents (nom, horaires, jours bitmask)
- **Users.shiftId** : affectation par défaut

### V2

- **`EmployeeScheduleEntry`** : planning **semaine par semaine** (qui travaille quel jour, poste, horaire exceptionnel)
- **Page `/admin/planning`** : édition grille semaine
- **Page `/admin/planning/affichage`** : écran mural (TV back-office) — gros texte, refresh auto 60 s

---

## 5. Tableau de bord & rapports

### Existant

- Dashboard admin (CA jour, commandes, graphiques)
- Rapports 7/30 j (CA, catégories, heures de pointe, paiements)
- Dépenses manuelles

### V2 enrichissements

| Rapport | Granularité | Données |
|---------|-------------|---------|
| CA | J / H / M / A | Commandes payées |
| Recettes vs dépenses | M / A | Orders + Expense |
| Marge brute estimée | M | CA − coût stock sorti (BOM × costCents) |
| Top ingrédients consommés | M | StockMovement OUT |
| Paie indicative | M | Attendance + salaires User |

---

## 6. Pages admin CRM (carte)

| Route | Statut | Rôle |
|-------|--------|------|
| `/admin` | ✅ | Dashboard |
| `/admin/orders` | ✅ | Commandes live |
| `/admin/stock` | ✅ | Stock + mouvements |
| `/admin/expenses` | ✅ | Dépenses |
| `/admin/reports` | ✅ | Rapports CA |
| `/admin/shifts` | ✅ | Créneaux récurrents |
| **`/admin/planning`** | 🆕 V2.1 | Planning hebdo employés |
| **`/admin/planning/affichage`** | 🆕 V2.1 | Affichage équipe |
| **`/admin/invoices`** | 🆕 V2.1 | Factures à la demande |
| `/admin/settings` | ✅ | SIRET, horaires (→ + email admin notif) |

---

## 7. Schéma Prisma V2 (ajouts)

- `MenuItemRecipe` — BOM pizza → ingrédients
- `Invoice` + `InvoiceLine` — facturation CRM
- `EmployeeScheduleEntry` — planning journalier
- `EmailLog` — traçabilité envois

---

## 8. Ordre d’implémentation recommandé

```
Semaine 1–2  │ Prisma V2 + API factures + page CRM factures
             │ React Email (3 templates : commande, facture, stock)
Semaine 3    │ Recettes BOM + déduction ingrédients + alertes mail
Semaine 4    │ Planning employés + écran affichage
Semaine 5–6  │ Rapports M/A + marge stock + rapport email quotidien
Q3 2026      │ Préparation PDP / Factur-X
Sept 2026    │ Réception e-factures fournisseurs
Sept 2027    │ Émission B2B conforme
```

---

## 9. Différenciation vs Wix / généralistes

| Besoin pizzeria | Wix / CMS | RestaurantOS |
|-----------------|-----------|--------------|
| KDS cuisine temps réel | ❌ | ✅ |
| POS SUNMI + TPE | ❌ | ✅ |
| Impression tickets / QR | ❌ | ✅ |
| Stock ingrédients pizza | ❌ | ✅ V2 |
| Tournée livreur GPS | ❌ | ✅ |
| Facturation métier FR | Plugin tiers | ✅ V2 natif |
| Offline comptoir | ❌ | ✅ |

**Positionnement** : « Le système d’exploitation de votre pizzeria » — pas un site vitrine seul.

---

## 10. Variables d’environnement mail

```env
EMAIL_SERVER_HOST=127.0.0.1
EMAIL_SERVER_PORT=1025
EMAIL_FROM="La Z Pizza <noreply@lazpizza.fr>"
ADMIN_NOTIFICATION_EMAIL=gerant@lazpizza.fr
PUBLIC_SITE_URL=https://app.lazpizza.fr
```

---

*Document généré pour le projet RestaurantOS / La Z Pizza — Fargues-Saint-Hilaire.*
