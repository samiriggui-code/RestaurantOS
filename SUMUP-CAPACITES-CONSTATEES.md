# Capacités réelles SumUp POS Pro (Tiller) — cash comptoir → RestaurantOS

> Statut : **investigation en cours**. Section 1 = lu dans la doc publique (non vérifié par test réel). Section 2 = protocole à exécuter (nécessite compte sandbox + iPad, actions humaines). Section 3 = à remplir après test.
> Objectif : savoir si RestaurantOS peut être notifié (lecture seule) de **toute** vente caisse, y compris le cash tapé manuellement au comptoir — pas seulement les commandes injectées via Purchase Request.

## 0. Accès fourni 2026-08-25 — ce que c’est (et ce que ce n’est pas)

Compte montré : sandbox marchand **`lazpizza`** / merchant code **`MBX6PS3C`** sur [me.sumup.com](https://me.sumup.com) + [developer.sumup.com](https://developer.sumup.com/) (onglets Sandboxes, Clés API, Applications OAuth2, Clés d’affiliation).

| Produit                                                                                                        | Ce compte                       | Utile pour les Tests 1–4 du skill POS Pro ? |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------- |
| **SumUp paiements** (Cloud API lecteur, checkout online, clés API / affiliate / OAuth developer.sumup.com)     | Oui — c’est exactement ça       | **Non**                                     |
| **SumUp POS Pro / Tiller** (caisse iPad NF525, Purchase Request, Callback ORDER, Catalog `api.tiller.systems`) | **Non présent** dans ces écrans | **Oui — manquant**                          |

Preuves de distinction :

- Le portail [developer.sumup.com](https://developer.sumup.com/) documente online + in-person payments (readers, checkout) — **pas** Purchase Request / callbacks ORDER Tiller (`llms.txt` sans POS Pro).
- L’API POS Pro est sur [tillersystems-v3.readme.io](https://tillersystems-v3.readme.io/reference) + OAuth `oauth.api.tiller.systems` + inscription intégration (Typeform AppMarket / back-office POS Pro).
- RestaurantOS a déjà les clés **paiement** SumUp (`SUMUP_*`) — même famille que ce sandbox. Ça ne débloque pas les webhooks caisse.

**Ne pas coller** les clés API / d’affiliation dans le repo ni dans le chat (elles étaient visibles à l’écran). Si une clé secrète a fuité, la régénérer dans Paramètres développeur.

**Prochaine action humaine pour débloquer le skill :**

1. Ouvrir / créer l’accès **SumUp POS Pro** (caisse), pas seulement le sandbox paiements : [inscription intégration](https://tillersystem.typeform.com/to/pWCFeIc7) ou AppMarket du magasin POS Pro client.
2. Récupérer `client_id` / `client_secret` **Tiller/POS Pro** + `storeId` + config callback ORDER.
3. iPad (ou simulateur) sur **ce** SANDBOX caisse — pas seulement me.sumup.com.
4. Puis enchaîner Tests 1–4 (§2) avec un collecteur [webhook.site](https://webhook.site).

### 0bis. Re-vérification empirique 2026-08-25 (pas juste inférence doc)

Poussé plus loin sur demande, en naviguant réellement le compte (pas en relisant la doc) :

- Le sandbox `lazpizza` (`Paramètres développeur > Sandboxes > Ouvert`) **contient bien "Caisse" dans sa sidebar** — le sandbox clone tout le compte marchand, produits inclus. Ça a semblé infirmer la distinction du §0.
- Mais `developer.sumup.com/api` (catalogue officiel) liste seulement : Checkouts, Readers, Customers, Transactions, Payouts, Receipts, Members, Memberships, Roles, Merchants. `developer.sumup.com/tools/sdks` (7 SDKs) et `developer.sumup.com/tools/llms` idem — **zéro mention Caisse/POS Pro/Tiller/Purchase Request/Order callback** dans les trois.
- `demarrage.sumup.com/caisse/configuration-de-base` (page produit Caisse, dans le sandbox comme sur le compte réel) n'expose que de la config UI (catalogue, TVA, employés, formules, conformité fiscale) — aucun onglet Intégrations/API/Webhooks trouvé.

**Conclusion confirmée (pas juste supposée) :** "Caisse" dans le sandbox = UI produit clonée, pas un accès API. Le §0 tenait. La voie reste l'inscription partenaire POS Pro (typeform) ou le support/account manager SumUp — pas de raccourci self-service depuis ce compte.

### 0ter. Réponse définitive du support SumUp (chat live, agent "Paul", 2026-08-25)

> "Non, vous ne possédez pas de caisse pro sur ce compte-là. Vous possédez la caisse plus en revanche."

**Root cause identifiée : ce n'est pas un problème d'accès API, c'est un problème de palier d'abonnement.** SumUp Caisse a (au moins) 3 offres : Gratuite / **Plus** (ce que le compte `lazpizza` possède actuellement) / **Pro** (celle qui expose l'API Callback ORDER + Purchase Request documentée sur tillersystems-v3.readme.io). Le compte actuel n'a jamais eu accès à cette API, quelle que soit la manière dont on la demande (typeform, chat, sandbox) — il faudrait upgrader vers Caisse Pro.

**Conclusion et recommandation :** investigation technique terminée ici. La suite est une décision commerciale (coût de l'upgrade Caisse Pro vs. valeur de la visibilité automatique sur les ventes comptoir), pas un blocage technique à débloquer. Vu que RestaurantOS a déjà sa propre traçabilité fiscale légale (journal `FiscalTicket` chaîné par hash, `requireFiscalTicketForPaidOrder`, indépendant de SumUp), rien de production ne dépend de cette décision — elle peut être tranchée sans urgence avec le client.

### 0quater. Test empirique API Transactions générique (hors Caisse Pro) — 2026-08-25

Hypothèse testée : l'API `Transactions` générique (disponible à tout palier, filtre `payment_types[]=CASH` documenté) pourrait-elle exposer les ventes cash de la Caisse sans passer par l'API POS Pro ?

**Test réalisé** : création d'une appli OAuth2 (`RestaurantOS`) sur le compte lazpizza, échange `client_credentials` → jeton obtenu avec scope `transactions.history`, appel `GET /v2.1/merchants/MBX6PS3C/transactions/history?payment_types[]=CASH`.

**Résultat `client_credentials` : `403 Forbidden — "claims required for merchant_read permission"`.**

**Test complémentaire — flux `authorization_code` (vrai consentement marchand) :** contrairement à `client_credentials`, ce flux fonctionne (`200`, jeton + `refresh_token` obtenus) sur le vrai compte de production (`M26X4YP5`). Donc l'automatisation est **techniquement possible** une fois le consentement initial donné — ce n'est plus bloqué côté auth.

**MAIS résultat non concluant sur le fond** : la requête `GET /transactions/history` (avec et sans filtre `payment_types[]=CASH`, plage 2024–2026) renvoie `{"items":[]}` — **parce que la Caisse SumUp du client n'est pas encore active en production** (mise en service prévue 2026-09-01 ; seul le catalogue produit a été chargé jusqu'ici, aucune vente réelle n'a eu lieu). Une liste vide par absence totale de données ne prouve donc rien sur la question initiale (les ventes Caisse remontent-elles dans ce registre générique ?). **Correction d'une conclusion prématurée** : une version précédente de cette section affirmait à tort que le test était concluant — ce n'était pas le cas, l'absence de transactions dans la fenêtre testée s'explique simplement par l'absence de toute activité commerciale sur ce compte à ce jour.

**Statut réel : question non tranchée, à retester après le 2026-09-01.** Une fois la Caisse active, refaire une vente test (cash) puis relancer exactement le même appel API (flux `authorization_code`, déjà validé mécaniquement) pour avoir une réponse définitive.

**En attendant (plan opérationnel, indépendant du résultat de ce test)** : import CSV manuel quotidien des exports SumUp (stock + réconciliation caisse) + ressaisie rapide pour le ticket cuisine au moment de la commande — voir conversation du 2026-08-25.

**Sécurité** : le `client_secret` de l'appli `RestaurantOS` et le jeton/refresh_token obtenus ont été utilisés plusieurs fois pendant ces tests (fichier + logs de commande) — à régénérer/supprimer dans SumUp > Applications OAuth2 après usage, et à refaire au moment du retest post-1er-septembre.

## 1. Ce que dit la documentation (non vérifié)

| Capacité                         | Constat doc                                                                                                                                                                                                                    | Source                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Callback ORDER — portée          | "Notify a consumer when an event occurs on a delivery or an order" — aucune distinction manuel/API dans le texte trouvé                                                                                                        | [callback-api-introduction](https://tillersystems-v3.readme.io/reference/callback-api-introduction)         |
| Payload `payments[]`             | `type` est une string libre, `"CASH"` donné comme exemple, pas de liste fermée d'enums                                                                                                                                         | [ORDER callback payload](https://tillersystems-v3.readme.io/reference/post_your-order-callback-endpoint)    |
| Payload — origine de la commande | Aucun champ n'indique si la commande vient de l'iPad (manuel) ou d'une Purchase Request                                                                                                                                        | idem                                                                                                        |
| `itemLines` / `preparations`     | Détaillé (produit, qty, UOM, TVA, statut, options, étapes de préparation) — a priori suffisant pour un ticket cuisine                                                                                                          | idem                                                                                                        |
| Purchase Request API             | **Écriture seule** (`purchase-request/write`), pas de scope lecture, sert uniquement à pousser delivery/click&collect vers la caisse                                                                                           | [purchase-request-introduction](https://tillersystems-v3.readme.io/reference/purchase-request-introduction) |
| `GET /orders/{id}`               | Lecture unitaire par UUID connu, pas de listing                                                                                                                                                                                | [order-api-readorder](https://tillersystems-v3.readme.io/reference/order-api-readorder)                     |
| **Search Orders**                | Filtres : `storeIds` (obligatoire), `statuses` (CLOSED/CANCELED), `openDate`/`closeDate` (plages), `waiterIds`, `orderIds`. **Aucun filtre par canal/origine** — hypothèse : retournerait aussi le cash comptoir, non confirmé | [searchorders](https://tillersystems-v3.readme.io/reference/searchorders)                                   |
| Price Book / Catalog             | Prix, produits, options, packages — **aucune notion de stock/inventaire**                                                                                                                                                      | [price-book-introduction](https://tillersystems-v3.readme.io/reference/price-book-introduction)             |
| Price book webhook               | Notifie seulement les MAJ de catalogue, pas les mouvements de stock                                                                                                                                                            | [price-book-webhook](https://tillersystems-v3.readme.io/reference/price-book-webhook)                       |

**Conclusion doc-only (hypothèse à vérifier, pas une réponse) :** l'absence de filtre par canal sur `Search Orders` et l'absence de champ d'origine dans le payload ORDER suggèrent que la caisse traite toutes les commandes (manuelles ou API) de façon uniforme côté callback/lecture — mais rien dans le texte ne l'affirme explicitement. C'est exactement ce que le test réel (§2) doit confirmer ou infirmer.

## 2. Protocole de test (à exécuter — nécessite compte sandbox + iPad)

**Prérequis (actions humaines, hors de portée de l'agent) :**

1. Compte marchand SANDBOX SumUp POS Pro : inscription via https://tillersystem.typeform.com/to/pWCFeIc7 (ou back-office AppMarket existant côté client).
2. iPad (ou simulateur) connecté à l'environnement SANDBOX.
3. Récepteur de webhook public : **https://webhook.site** (ouvrir la page, copier l'URL unique générée — zéro compte, zéro install). Alternative : ngrok si préféré, mais webhook.site suffit et évite d'exposer une machine locale.

**Test 1 — Callback sur commande manuelle cash**

1. Sur le dashboard sandbox POS Pro, enregistrer l'URL webhook.site comme endpoint de callback ORDER.
2. Sur l'iPad sandbox, taper une commande manuellement (2-3 articles), encaisser en **cash**.
3. Observer si un événement arrive sur webhook.site. Noter le payload complet (`payments[].type`, `itemLines`, délai de réception).

**Test 2 — Comparaison avec Purchase Request**

1. Envoyer une Purchase Request `clickAndCollect` de test vers le sandbox.
2. Encaisser sur l'iPad (carte).
3. Comparer le payload callback reçu avec celui du Test 1 — mêmes champs, même fiabilité ?

**Test 3 — Fiabilité / rejeu**

1. Couper temporairement la réception (supprimer l'URL webhook.site ou la rendre invalide) pendant un encaissement.
2. Vérifier s'il y a retry plus tard.
3. Tester `Search Orders` avec `storeIds` + `closeDate` du jour pour voir si la commande manquée est rattrapable après coup.

**Test 4 — Stock**

1. Vérifier si le Price Book sandbox expose des quantités (pas seulement prix/produits).
2. Vérifier si une vente comptoir déclenche un signal quelconque côté stock (webhook dédié ou champ dans le callback ORDER).

## 3. Résultats constatés (à remplir après exécution)

_Vide — en attente des résultats des Tests 1 à 4. Coller ici les payloads bruts (anonymisés si besoin) et les conclusions._

## 4. Recommandation d'architecture RestaurantOS

_À rédiger uniquement une fois la Section 3 remplie — pas avant. Ne doit reposer que sur les résultats constatés, pas sur la doc commerciale._
