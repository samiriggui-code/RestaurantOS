# Attestation logiciel de caisse — modèle BOFiP

Référence : [BOI-TVA-DECLA-30-10-30](https://bofip.impots.gouv.fr) — attestation du logiciel de caisse ou de système de caisse.

**Logiciel :** RestaurantOS — édité pour La Z Pizza  
**Version :** `FISCAL_SOFTWARE_VERSION` (défaut `1.0.0`)  
**Date de mise en service :** `FiscalSequence.commissionedAt` (consultable dans `/admin/fiscal`)

---

## 1. Identification de l'éditeur / intégrateur

| Champ | Valeur |
|-------|--------|
| Raison sociale éditeur | _[À compléter]_ |
| SIRET éditeur | _[À compléter]_ |
| Adresse | _[À compléter]_ |
| Contact | _[À compléter]_ |

## 2. Identification de l'assujetti utilisateur

| Champ | Valeur |
|-------|--------|
| Raison sociale | _[Nom pizzeria — Business.name]_ |
| SIRET | _[Business.siret]_ |
| Adresse établissement | _[Business.address]_ |
| N° TVA intracommunautaire | _[Business.vatNumber]_ |

## 3. Identification du logiciel

| Champ | Valeur |
|-------|--------|
| Nom commercial | RestaurantOS |
| Version certifiée | 1.0.0 |
| Type | Logiciel de caisse (site web + POS SUNMI/tablette) |
| Hébergement | VPS Docker (PostgreSQL 16) |

## 4. Déclaration de conformité (article 286 I-3° bis du CGI)

L'éditeur déclare que le logiciel **RestaurantOS** version **1.0.0** :

1. **Inaltérabilité** — enregistre les données de vente dans `FiscalTicket` à l'encaissement ; corrections par avoir (`VOID`) uniquement ; triggers PostgreSQL anti-modification.
2. **Sécurisation** — chaînage HMAC-SHA256 des tickets, événements JET et clôtures ; numérotation séquentielle.
3. **Conservation** — clôture journalière Z ; grand total perpétuel ; archives annuelles figées.
4. **Archivage** — export JSON annuel avec empreinte SHA-256 (`FiscalArchive`).

Fonctions livrées :

- Tickets fiscaux vente / avoir / formation
- Journal des événements techniques (JET)
- Clôture Z manuelle + rappel + auto 23h55 Europe/Paris
- Avoir automatique à l'annulation d'une vente payée
- Reçu fiscal par email (commandes web Stripe)
- Réimpression DUPLICATA (24 h, JET `REPRINT`)

## 5. Limites connues (transparence)

- **Pas de certification NF525** tierce partie à ce jour.
- Logiciel **en cours d'attestation** — relecture **expert-comptable obligatoire** avant signature.
- Paiement carte manuel : référence TPE obligatoire saisie par le caissier.

## 6. Signatures

| Rôle | Nom | Date | Signature |
|------|-----|------|-----------|
| Éditeur / intégrateur | | | |
| Expert-comptable (revue) | | | |
| Assujetti (gérant) | | | |

---

*Ce modèle est fourni à titre de base. Seul un expert-comptable peut valider la conformité au regard de la réglementation en vigueur.*
