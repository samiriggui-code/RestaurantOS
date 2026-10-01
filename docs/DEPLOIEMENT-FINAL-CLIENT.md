# Livraison La Z Pizza (version Atmane) — checklist

> Une seule page à cocher, de la branche de dev jusqu'à la remise des clés.
> Périmètre : **1 tablette boutique · caisse SumUp · commandes en ligne payées SumUp**.
> Détails techniques : [`VPS-DEPLOIEMENT.md`](VPS-DEPLOIEMENT.md) · [`../deploy/README.md`](../deploy/README.md) · [`../deploy/FISCAL-OPS.md`](../deploy/FISCAL-OPS.md)

---

## 0. Ce qui est livré (et ce qui ne l'est pas)

| Élément                | Solution                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| Site public            | `lazpizza.fr` — menu, commande en ligne (invité), **paiement SumUp**, suivi de commande    |
| Tablette boutique      | **1 tablette**, APK `kds` (ouvre `/kitchen`) — bascule cuisine / back-office / livreur     |
| Ventes comptoir        | **Terminal SumUp** du client — synchro auto des transactions (API) + import CSV du journal |
| Facturation            | Factures depuis les transactions SumUp + commandes web                                     |
| Dépenses               | **Pennylane** (token saisi dans Admin → Intégrations) → reporting ventes vs dépenses       |
| Impression (optionnel) | Epson cuisine sur le LAN (IP fixe)                                                         |
| Back-office            | `app.lazpizza.fr/admin`                                                                    |

**Hors périmètre — ne pas activer, ne pas promettre :** POS / caisse tablette, totem (kiosk), réservations, tables, Wi-Fi client, Deliveroo, Uber Eats, Stripe.

---

## 1. Code — finir la branche

- [ ] Tests serveur verts : `npm test` (339 OK au 01/10/2026)
- [ ] Typecheck : `npm run typecheck`
- [ ] Recette visuelle en local : `npm run dev` → http://localhost:3000 (site + `/admin` + `/kitchen`)
- [ ] PR `feat/sumup-pennylane-reporting-kiosk` → `main`, relue et fusionnée

## 2. À obtenir du client

- [ ] **Token API Pennylane** (bloquant pour les dépenses du reporting)
- [ ] Confirmation des clés SumUp de prod (merchant `M26X4YP5`) — déjà présentes sur le VPS
- [ ] Boîte mail `commandes@lazpizza.fr` à créer chez Hostinger (SMTP) — ne pas utiliser la boîte perso `atmane.chennit@lazpizza.fr` (qui reçoit les notifications admin)
- [ ] Menu réel validé (produits, prix TTC, TVA) et horaires
- [ ] SIRET, n° TVA, raison sociale (mentions sur les tickets)
- [ ] Coordonnées de l'expert-comptable (attestation fiscale)

## 3. Déploiement VPS

> VPS Hostinger **partagé** : rester dans `/opt/pizzeria` et ne toucher qu'aux conteneurs `pizzeria-*`.

- [ ] `.env` à partir de [`deploy/.env.production.example`](../deploy/.env.production.example) — **secrets neufs** :
  - `JWT_SECRET`, `REFRESH_SECRET`, `DB_PASSWORD`
  - `FISCAL_HMAC_SECRET` (distinct de `JWT_SECRET`) — ⚠️ **ne plus jamais le changer après mise en service**
  - `ENABLED_MODULES=menu,kitchen,orders,reports,users,settings,expenses,loyalty,shifts` (**sans** `pos` ni `kiosk`)
  - `SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE`, `API_PUBLIC_BASE_URL=https://api.lazpizza.fr` (retours de paiement SumUp)
  - `DRIVER_ACCESS_PIN` **neuf**
- [ ] Déployer :
  ```bash
  cd /opt/pizzeria && git pull
  docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
  docker compose exec server npx prisma migrate deploy
  ```
- [ ] `https://lazpizza.fr`, `https://app.lazpizza.fr/admin`, `https://api.lazpizza.fr/api/health` répondent en HTTPS
- [ ] BDD **sans données de démo ni commandes de test**

## 4. Mise en service en boutique

### Tablette

- [ ] Installer l'APK `kds` (`./gradlew assembleKdsRelease`, voir [`../android/README.md`](../android/README.md))
- [ ] Admin → Appareils → **« Utiliser l'IP de ce réseau »** (depuis le Wi-Fi de la boutique)
- [ ] Jumeler la tablette (code à 6 chiffres)
- [ ] Imprimante Epson cuisine (si présente) : IP fixe saisie dans l'onglet Réseau, puis **test d'impression**

### Intégrations

- [ ] Admin → Intégrations → **SumUp** : connexion OK, première synchro des transactions visible
- [ ] Admin → Intégrations → **Pennylane** : token saisi, dépenses remontées
- [ ] Rapport **ventes vs dépenses** cohérent sur une journée connue (comparer au journal SumUp)

### Fiscal

- [ ] Paramètres → Établissement : SIRET, TVA, raison sociale
- [ ] Date de mise en service = premier service réel · **mode formation OFF**
- [ ] Contrôle de chaîne vert (`npm run fiscal:verify-chain --prefix server`)

## 5. Recette (sur place, avec la vraie tablette)

- [ ] Commande **en ligne** payée SumUp (petit montant réel) → apparaît en cuisine en temps réel → email de confirmation reçu
- [ ] Suivi client `lazpizza.fr/suivi/:token` OK
- [ ] Statuts cuisine : en préparation → prête → en livraison → app livreur (code client à 4 chiffres)
- [ ] Vente **comptoir** sur le terminal SumUp → remonte dans l'admin après synchro → facture générable
- [ ] Coupure Wi-Fi tablette → reprise propre à la reconnexion
- [ ] Depuis la 4G : `/kitchen` **inaccessible**, `/admin` accessible
- [ ] Rembourser la commande test · fin du premier service → **clôture Z**

## 6. Sécurité — avant la remise

- [ ] ⚠️ **Tous les PIN du labo changés** : `2580`, `3456`, `2468` sont grillés (affichés publiquement en 07/2026)
- [ ] Aucun PIN affiché sur une page publique (`/livreur`)
- [ ] Mot de passe admin fort, remis en main propre
- [ ] `FISCAL_ALLOW_JET_REPAIR=false`
- [ ] Sauvegarde quotidienne active (`deploy/scripts/install-backup-cron.sh`) **et restauration testée une fois**

## 7. Remise au client

- [ ] Identifiants admin + PIN cuisine / livreur (nouveaux)
- [ ] Formation du gérant : cuisine sur la tablette, synchro et import CSV SumUp, factures, dépenses et reporting, menu, prix, horaires, **clôture Z chaque soir**
- [ ] Doc incidents : coupure de courant, plus de papier, plus de Wi-Fi, tablette HS (Appareils → dissocier → rejumeler)
- [ ] Expert-comptable : revue de [`conformite-article-286-cgi.md`](conformite-article-286-cgi.md) + signature de [`attestation-logiciel-caisse-bofip.md`](attestation-logiciel-caisse-bofip.md)
- [ ] Formulation : « conformité ISCA (art. 286 CGI) » — **jamais « certifié NF525 »**

---

## GO final

- [ ] Branche fusionnée et déployée, 3 hosts en HTTPS
- [ ] SumUp : paiement en ligne réel + synchro comptoir OK
- [ ] Pennylane branché
- [ ] Tablette jumelée, recette passée, commande test remboursée
- [ ] PIN et secrets neufs, sauvegardes actives
- [ ] Gérant formé, attestation en cours chez l'expert-comptable

_Réécrit le 01/10/2026 pour la version Atmane (1 tablette, SumUp, sans POS). Remplace la version CDC v2.4 (Stripe, Zelty, 2 tablettes, POS)._
