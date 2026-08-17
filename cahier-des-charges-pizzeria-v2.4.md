# Cahier des charges — Solution digitale de commande et d'encaissement pour pizzeria

**Version :** 2.4 — Juillet 2026
**Statut :** Draft pour validation client
**Évolution majeure vs v1.0 :** le développement s'appuie sur le projet open source **RestaurantOS** (licence MIT) comme socle applicatif, adapté et étendu, au lieu d'un développement intégral from scratch. Délai et coût réduits par rapport au from scratch (v1.0 : 9–13 semaines).

**Évolution v2.0 → v2.1 :** abandon de Vite ; toute l'UI dans **Next.js** (`app.pizzeria.fr/`) ; API **Express** (`server/`) ; **Traefik** (VPS Hostinger) ; dev local **Laragon**.

**Évolution v2.1 → v2.2 :** prérequis WebView ≥ 64 (phase 0 bloquante) ; planning recalculé ; middleware routage par hôte ; mode dégradé POS clarifié (APK résidente) ; parité PostgreSQL Laragon/Docker ; i18n **next-intl** ; `client/` exclu du build/CI.

**Évolution v2.2 → v2.3 (conformité fiscale) :** mise en conformité avec la loi anti-fraude à la TVA (art. 286, I-3° bis du CGI — critères ISCA) par **intégration API vers une caisse enregistreuse certifiée** (type Zelty ou équivalent) **que le client doit acquérir**. La plateforme développée est un **système d'orchestration et de prise de commande** ; la caisse certifiée est le **registre fiscal unique** de tous les encaissements. Nouveau module E (intégration caisse), phase 0 étendue, planning et coûts récurrents recalculés.

**Évolution v2.3 → v2.4 (remaniement matériel) :** **abandon du terminal SUNMI V2 comme POS**, techniquement non réalisable : système Android bridé, WebView d'usine impossible à mettre à jour, incompatible avec le runtime Next.js moderne — risque contractuel inacceptable. **Le principe des APK WebView est conservé**, mais sur du matériel standard :
- **APK caisse** sur **tablette comptoir** pour la prise de commande sur place, avec **imprimante thermique Epson comptoir** (reçus clients) ;
- **APK KDS** sur **tablette cuisine**, avec **imprimante thermique Epson cuisine** (tickets de préparation) ;
- **APK livreur** sur smartphone (tournées de livraison, statuts) ;
- **Site web** pour les commandes en ligne (inchangé) ;
- **Intégration API caisse certifiée** (type Zelty ou équivalent — module E, inchangé).

Conséquences : suppression du pont `window.SunmiPrinter` et du prérequis « WebView ≥ 64 sur SUNMI » (les tablettes standard ont une WebView à jour via Play Store) ; impression comptoir **et** cuisine via **Epson ePOS-Print** sur le réseau local ; parcours livreur ajouté ; planning recalculé. Mise à jour réglementaire au passage : attestation individuelle de l'éditeur rétablie par la loi de finances 2026 (voir §2bis.1, sources officielles).

Deux règles actées en v2.4 :
- **Livraison uniquement prépayée** : une commande en livraison est obligatoirement **payée en ligne** avant toute prise en charge — le livreur ne transporte que des produits déjà payés et **n'encaisse jamais** ; sans paiement confirmé, pas de livraison.
- **Option de repli fiscale conservée** : le développement d'un module fiscal ISCA en propre (§2bis.4) est **maintenu au cahier des charges** comme solution de secours si aucune caisse certifiée (Zelty ou autre) n'offre d'API garantissant l'intégration requise.

---

## 1. Contexte et objectifs

Le client, une pizzeria, souhaite se doter d'une solution unifiée permettant de gérer les commandes passées **en ligne** (site web) et **sur place** (en boutique), avec impression automatique des tickets de préparation sur une **imprimante thermique Epson en cuisine**, **en conformité avec la réglementation française sur les logiciels de caisse**.

### Objectifs

1. Offrir aux clients finaux un site web vitrine avec commande en ligne (click & collect et/ou livraison), avec paiement en ligne.
2. Centraliser toutes les commandes (en ligne + sur place) dans un back-office unique.
3. Équiper le comptoir d'une **tablette caisse (APK dédiée)** pour la prise de commande sur place, avec **imprimante Epson comptoir** pour les reçus clients.
4. Afficher les commandes en temps réel sur une **tablette KDS en cuisine (APK dédiée)**, avec impression automatique des tickets de préparation sur l'**imprimante Epson cuisine**.
5. Outiller la **livraison** avec une **APK livreur** sur smartphone (commandes à livrer, itinéraire, statut « en livraison » / « livrée » propagé au suivi client). **Livraison exclusivement de commandes déjà payées en ligne** — aucun encaissement à la livraison.
6. Minimiser les coûts récurrents : hébergement sur VPS unique au nom de domaine du client ; **pas d'abonnement SaaS pour la plateforme développée**. L'abonnement à la **caisse certifiée** (§2bis) est accepté car il répond à une **obligation légale** (art. 286 CGI) que la plateforme ne porte pas elle-même.
7. **Capitaliser sur l'open source** : socle RestaurantOS (MIT) audité puis adapté, afin de réduire les délais et le coût de développement.
8. **Garantir la conformité fiscale** de l'ensemble des encaissements (espèces, carte TPE, paiement en ligne Stripe) via l'enregistrement systématique des ventes dans la caisse certifiée du client (§2bis, module E).

### Hors périmètre (V1)

- Intégration protocolaire avec le TPE bancaire (paiement sur place sur TPE indépendant, saisie manuelle du montant).
- Programme de fidélité, gestion des stocks, comptabilité.
- Application mobile native grand public (le site est responsive). *Les APK caisse/KDS/livreur sont des enveloppes WebView internes au personnel, pas des applications natives complètes.*
- **Tout support du matériel SUNMI** (V2/V2s/V3) *(retiré en v2.4)* : système bridé, WebView non maintenable — le terminal du client n'est pas réutilisé par la solution.
- **Développement d'un module fiscal ISCA en propre** (inaltérabilité, chaînage cryptographique, clôtures Z, journal des événements techniques, archivage fiscal) : cette responsabilité est **portée par la caisse certifiée** et son éditeur. Le prestataire ne délivre **aucune attestation individuelle de conformité** au sens du BOFiP ; la preuve de conformité (certificat d'organisme accrédité ou attestation individuelle de l'éditeur de la caisse) est fournie par l'éditeur de la caisse au client.
- **Modules RestaurantOS non utilisés** : portail WiFi invité, gestion de tables/QR de table, réservations, fidélité, plannings/pointage du personnel (shifts), gestion des dépenses, licences. Ces modules sont **désactivés par feature flags** (voir §6.4) mais leur code est conservé.
- **Vite** : le dossier `client/` (SPA Vite) est **remplacé** par `app.pizzeria.fr/` (Next.js). Aucun nouveau développement dans `client/` ; dossier **exclu du build Docker et de la CI**.

---

## 2. Socle applicatif : RestaurantOS

### 2.1 Justification du choix

- **Licence MIT** : usage, modification et exploitation commerciale libres ; seule la notice de copyright doit être conservée.
- Couverture fonctionnelle native d'environ 70 % du besoin : menu avec catégories et **options/suppléments (modifiers)**, POS multi-modes (sur place / à emporter / livraison), **Kitchen Display temps réel avec notifications sonores**, paiements Stripe avec vérification de signature webhook, mode hors-ligne (file IndexedDB), sécurité applicative (JWT, rate limiting, helmet CSP, sanitization XSS).
- Stack cible : TypeScript, React 18, **Next.js App Router** (UI), **Express** (API), **Prisma**, **Socket.io**, Docker Compose, **Traefik** (VPS).

### 2.2 Jalon go/no-go — phase 0 (bloquant)

Avant tout développement, **trois vérifications obligatoires** conditionnent la poursuite du projet :

**2.2.1 Audit technique du socle** (≈ 1 journée) — sécurité des routes Express, gestion des webhooks Stripe, qualité du schéma Prisma, dépendances vulnérables (`npm audit`).

**2.2.2 Validation de la chaîne d'impression Epson** *(remplace la faisabilité WebView SUNMI de la v2.3)* — sur le(s) modèle(s) d'imprimante retenu(s) (gamme **Epson TM**, ex. TM-m30III comptoir et cuisine) :
- impression depuis la WebView de l'APK (tablette) via **Epson ePOS-Print (SDK JavaScript)** sur le réseau local, imprimantes en IP fixe ;
- **contexte HTTPS** : la page `app.pizzeria.fr` étant servie en HTTPS, l'appel à l'imprimante locale doit être en HTTPS également (TLS embarqué de l'imprimante + certificat installé sur les tablettes) — à valider sur matériel réel ; en repli : **pont d'impression natif dans l'APK** (l'APK relaie en ESC/POS TCP 9100 vers l'imprimante, à la manière du pont SUNMI de la v2.3) ;
- remontée d'état (papier, capot, hors-ligne) exploitable pour la table `PrintJob` ;
- impression **sans dépendance à Internet** (tablette et imprimante sur le même LAN) ;
- vérification (rapide, non bloquante) que les tablettes retenues disposent des services Google et d'une **WebView à jour via Play Store** — c'est le cas du matériel standard, contrairement au SUNMI bridé.

**2.2.3 Choix et validation de la caisse certifiée** — sélection avec le client de la caisse certifiée (Zelty ou équivalent, voir §2bis.3) et **validation technique de son API** avant tout développement du module E :
- preuve de conformité **en cours de validité** : certificat d'organisme accrédité (NF525/LNE) **ou attestation individuelle de l'éditeur** (à nouveau recevable depuis la loi de finances 2026 — voir §2bis.1 ; le certificat d'organisme accrédité reste préféré), dont le **périmètre couvre l'ingestion de commandes externes via API** (canal « commande en ligne / partenaires ») — motif classique de non-conformité : certificat général ne couvrant pas le module d'injection ;
- capacités API requises : création de commande avec détail articles/options, **ventilation TVA multi-taux** (5,5 / 10 / 20 %), remises, **enregistrement du règlement** (espèces, carte TPE, « payé en ligne ») ou à défaut circuit de validation du règlement sur la caisse ; idéalement horodatage d'origine pour la resynchronisation du mode dégradé ;
- conditions d'accès : coût de l'abonnement, frais éventuels d'accès API / programme partenaire, environnement de test (sandbox) disponible ;
- compatibilité matérielle : certaines caisses certifiées tournent sur tablette ou fournissent leur propre matériel — à évaluer (scénario « caisse sur la tablette comptoir » vs « caisse sur poste dédié »).

**Conséquences d'un no-go :** échec audit code (2.2.1) → repli sur le plan « from scratch » v1.0. Échec impression (2.2.2) → changement de modèle d'imprimante ou pont d'impression natif dans l'APK ; le reste du projet poursuit. Absence de caisse certifiée à API adéquate (2.2.3) → **activation de l'option de repli conservée à cet effet** : le module E est remplacé par le développement d'un module fiscal ISCA en propre avec attestation individuelle du prestataire, juridiquement recevable depuis la LF 2026 (avenant : +5 à 8 j, voir §2bis.4).

### 2.3 Adaptations du socle (arbitrages actés)

| # | Sujet | RestaurantOS d'origine | Décision | Effort |
|---|---|---|---|---|
| A1 | Base de données | SQLite | **Migration PostgreSQL** (Laragon en local, conteneur Docker en prod) ; régénération des migrations Prisma | ½ j |
| A2 | Montants | Prix en `Float` | **Conversion en entiers (centimes)** à l'occasion de la refonte des migrations (A1) | inclus A1 |
| A3 | Multi-tenant | `businessId` sur toutes les entités | **Conservé et neutralisé** : un seul `Business` créé au seed, identifiant fixé en variable d'environnement (`BUSINESS_ID`) | qq h |
| A4 | Authentification | JWT custom (bcrypt, rate limiting, rôles) | **Conservé** — audit du JWT inclus dans le jalon §2.2. Ajout du rôle **livreur**. Commande en ligne en invité → pas de compte client en V1 | 0 (+2 h audit) |
| A5 | Temps réel | Socket.io | **Conservé** — reconnexion automatique ; WebView à jour des tablettes standard (Play Store) | 0 |
| A6 | Langue / devise | Bilingue AR/EN, i18next | **Français uniquement**, devise **EUR** (centimes). i18n UI : **next-intl** dans `app.pizzeria.fr/` | 1 j |
| A7 | Statuts de commande | PENDING → PREPARING → READY → … | **Ajout de `PENDING_PAYMENT`** (web : `PENDING_PAYMENT` → webhook Stripe signé → `CONFIRMED` → push temps réel + impression + **injection caisse** ; comptoir : `CONFIRMED` direct) et de **`OUT_FOR_DELIVERY`** (commandes en livraison, APK livreur) | 1–1,5 j |
| A8 | Modules hors périmètre | WiFi, tables, réservations, fidélité, shifts, dépenses, licences actifs | **Feature flags** (`ENABLED_MODULES`) : navigation masquée et routes API désactivées (404/403). Code et tables conservés | ½ j |
| A9 | Frontend | SPA **Vite** + `react-router` (`client/`) | **Remplacé par Next.js App Router** dans `app.pizzeria.fr/` — port des composants React existants. **Vite interdit**. POS/KDS/livreur : Client Components dans les APK WebView (matériel standard, WebView à jour) | 4–6 j |
| A10 | Reverse proxy | Caddy (socle d'origine) | **Traefik** sur le VPS Hostinger (stack Docker existante, réseau externe `traefik`) | ½ j |
| A11 | **Conformité fiscale** | Aucune (socle non conforme art. 286 CGI pour la France) | **Intégration API caisse certifiée** (module E) : toute vente encaissée (comptoir et web) est enregistrée dans la caisse certifiée du client. La plateforme n'enregistre pas d'encaissement faisant foi fiscalement | 3–5 j |
| A12 | **Impression** *(remanié v2.4)* | WebUSB / `react-to-print` ; v2.3 : SDK SUNMI | **Epson ePOS-Print (SDK JS)** depuis les APK vers les imprimantes Epson TM du LAN (comptoir : reçus ; cuisine : tickets de préparation) ; table `PrintJob` ; repli pont natif ESC/POS dans l'APK (§2.2.2) | 2–4 j |
| A13 | **Parcours livreur** *(nouveau v2.4)* | Aucun | Route `(livreur)` + APK livreur : liste des commandes à livrer, itinéraire (intent Google Maps), statuts `OUT_FOR_DELIVERY` → livrée, propagation au suivi client | 2–3 j |

---

## 2bis. Conformité fiscale — architecture « caisse certifiée »

### 2bis.1 Rappel du cadre légal

Tout assujetti à la TVA qui enregistre les règlements de clients particuliers au moyen d'un logiciel ou système de caisse doit utiliser un système satisfaisant aux conditions d'**inaltérabilité, sécurisation, conservation et archivage** des données (critères ISCA — art. 286, I-3° bis du CGI). La preuve est apportée par un **certificat délivré par un organisme accrédité** (NF525/LNE) **ou par une attestation individuelle de l'éditeur** : la loi de finances pour 2026 (loi n° 2026-103 du 19 février 2026, art. 125) **rétablit l'attestation individuelle** et annule la fin de l'auto-certification qui avait été programmée (initialement au 1er mars 2026, puis repoussée au 31 août 2026). Sanction : amende de **7 500 € par logiciel non conforme** (art. 1770 duodecies CGI), 60 jours pour régulariser.

**Précisions officielles** (impots.gouv.fr, FAQ « champ d'application » mise à jour du 21/05/2026 ; economie.gouv.fr, fiche « certification des logiciels de caisse » du 24/02/2026) :
- l'obligation vise **tous les modes de règlement** (espèces, chèques, CB, virements, prélèvements) — pas seulement les espèces — et s'applique **aussi au e-commerce** dès lors que la clientèle comprend des particuliers ;
- les **stricts terminaux de paiement (TPE) sont exclus** du dispositif : le TPE ne trace que le paiement carte, Stripe ne trace que le flux monétaire en ligne ; ni l'un ni l'autre n'enregistre la **vente** (détail articles, ventilation TVA) ;
- pour un **logiciel multifonctions** (comptabilité/gestion/caisse), **seules les fonctions caisse enregistreuse/encaissement doivent être certifiées**, et non l'ensemble du logiciel — c'est le fondement de l'architecture retenue au §2bis.2 (plateforme = gestion/orchestration non certifiée ; caisse certifiée = encaissement) ;
- la loi **n'impose pas** de détenir un logiciel de caisse ; mais dès qu'un logiciel enregistrant les règlements est utilisé, il entre dans le champ de l'obligation ;
- exceptions : B2B exclusif, franchise en base de TVA, opérations exonérées, remboursement forfaitaire agricole ; economie.gouv.fr mentionne aussi le cas des assujettis dont **tous** les paiements sont intermédiés par un établissement bancaire établi en France ou dans l'UE — **sans objet ici** (la pizzeria accepte les espèces), point à faire confirmer par l'expert-comptable en phase 0.

La pizzeria (clients particuliers, espèces acceptées, assujettie à la TVA) est **pleinement concernée**.

*Sources : [economie.gouv.fr — Ce qu'il faut savoir sur la certification des logiciels de caisse](https://www.economie.gouv.fr/entreprises/gerer-son-entreprise-au-quotidien/gerer-sa-comptabilite-et-ses-demarches/ce-quil-faut-savoir-sur-la-certification-des-logiciels-de-caisse) · [impots.gouv.fr — Champ d'application de l'obligation](https://www.impots.gouv.fr/professionnel/questions/quel-est-le-champ-dapplication-de-lobligation-de-detenir-un-logiciel-de) · BOFiP BOI-TVA-DECLA-30-10-30.*

### 2bis.2 Principe d'architecture retenu

Séparation stricte des responsabilités, sur le modèle éprouvé des intégrateurs du marché (totems, click & collect, agrégateurs) :

- **La plateforme développée** (site public, POS tablette comptoir, KDS, APK livreur, back-office/CRM) = **prise de commande, orchestration cuisine, livraison, suivi client, statistiques**. Elle ne constitue pas le registre fiscal des encaissements. Les logiciels de gestion ne sont pas visés par l'obligation dès lors que la brique « gestion des règlements » est portée par un système conforme (cf. règle « logiciels multifonctions » du §2bis.1) ; l'export/l'échange de données avec la caisse ne contamine pas la plateforme.
- **La caisse certifiée du client** (Zelty ou équivalent) = **registre fiscal unique**. Toutes les ventes y sont enregistrées via API : commandes comptoir (règlement espèces ou carte TPE) et commandes web (règlement « payé en ligne » / Stripe). Journal fiscal, clôtures Z, ventilation TVA, archivage : portés par la caisse et garantis par son éditeur (certificat ou attestation + mises à jour réglementaires).

**Trois conditions structurantes (engagements de conception) :**
1. **Exhaustivité** — 100 % des encaissements (espèces comprises) sont enregistrés dans la caisse. Le POS comptoir ne « déclare » plus un règlement dans la seule base de la plateforme : la validation d'une commande comptoir déclenche l'enregistrement de la vente et de son règlement dans la caisse.
2. **Ventes web incluses** — toute commande `CONFIRMED` par webhook Stripe est injectée dans la caisse avec le mode de règlement « paiement en ligne », afin que les clôtures Z et la déclaration de TVA reflètent la totalité du chiffre d'affaires (une seule source pour l'expert-comptable).
3. **Reçu client fiscal issu de la caisse** — le reçu remis au client (ventilation TVA, totaux) est émis par la caisse, ou imprimé sur l'**imprimante Epson comptoir** **à partir des données et du numéro de ticket renvoyés par la caisse**. Les tickets **cuisine** (documents de préparation, non fiscaux) restent imprimés directement par la plateforme sans contrainte.

### 2bis.3 Choix de la caisse (à arbitrer en phase 0 — §2.2.3)

Candidats indicatifs (restauration, API ouverte, certifiés) : **Zelty, L'Addition, Cashpad, Lightspeed Restaurant, Popina** — liste à confronter en phase 0 aux critères du §2.2.3 (périmètre de la preuve de conformité couvrant l'API, capacités de l'API règlements/TVA, sandbox, coûts, matériel éventuellement fourni par l'éditeur). Le choix final appartient au client ; l'abonnement et le contrat caisse sont souscrits directement par le client auprès de l'éditeur.

### 2bis.4 Option de repli — module fiscal ISCA en propre (**conservée au cahier des charges**)

Cette option est **explicitement maintenue** comme solution de secours pour le cas où la phase 0 (§2.2.3) conclurait qu'**aucune caisse certifiée (Zelty ou autre) n'offre d'API garantissant l'intégration requise** (périmètre de la preuve de conformité couvrant l'injection, enregistrement des règlements, ventilation TVA multi-taux, sandbox exploitable).

Contenu : développement d'un module fiscal ISCA en propre — immutabilité des tickets, chaînage cryptographique, clôtures Z, totaux perpétuels, journal des événements techniques, archivage fiscal 6 ans — couvert par une **attestation individuelle du prestataire**, mécanisme à nouveau juridiquement recevable depuis la loi de finances 2026 (§2bis.1).

Conditions d'activation : constat d'échec du §2.2.3 arbitré avec le client et son expert-comptable ; avenant de **+5 à 8 j** ; **responsabilité d'éditeur et maintenance réglementaire dans la durée** assumées par le prestataire (veille légale, mises à jour, renouvellement de l'attestation).

La voie privilégiée reste le module E (caisse certifiée) ; ce repli garantit que le projet aboutit à une solution conforme **dans tous les cas**, avec ou sans caisse à API adéquate sur le marché.

---

## 3. Acteurs et rôles

| Acteur | Description | Interface utilisée |
|---|---|---|
| **Client final** | Consulte le menu, commande et paie en ligne, ou commande au comptoir | Site public Next.js — `pizzeria.fr` |
| **Employé comptoir** | Saisit les commandes sur place, encaisse (TPE à part), remet le reçu (imprimante Epson comptoir) | **APK caisse** (WebView) sur tablette comptoir — `app.pizzeria.fr/pos` |
| **Cuisine** | Visualise le flux de commandes, fait évoluer leur statut ; tickets de préparation sur l'imprimante Epson cuisine | **APK KDS** (WebView) sur tablette cuisine — `app.pizzeria.fr/kitchen` |
| **Livreur** *(nouveau v2.4)* | Consulte les commandes à livrer, ouvre l'itinéraire, passe les statuts « en livraison » / « livrée » | **APK livreur** (WebView) sur smartphone — `app.pizzeria.fr/livreur` |
| **Gérant (admin)** | Gère le menu, les prix, les horaires, consulte l'historique et les statistiques | Back-office Next.js — `app.pizzeria.fr/admin` |
| **Caisse certifiée** | Registre fiscal : reçoit toutes les ventes via API, produit clôtures Z et documents fiscaux | Caisse de l'éditeur retenu (Zelty ou équivalent) + son back-office éditeur |
| **Expert-comptable du client** *(consulté)* | Valide le schéma de flux fiscal et le choix de la caisse en phase 0 | — |

---

## 4. Description fonctionnelle

### 4.1 Module A — Site public Next.js (landing + commande en ligne)

Développé dans `app.pizzeria.fr/app/(public)/`, consomme l'**API Express** (`api.pizzeria.fr`). Rendu serveur Next.js pour le SEO.

**A1. Landing page** — identité, photos, horaires, adresse/carte, téléphone, réseaux sociaux ; bandeau « Ouvert / Fermé — réouverture à HH:MM » (horaires + **fermetures exceptionnelles**) ; mobile first, SEO local (schema.org LocalBusiness, Lighthouse > 90).

**A2. Catalogue / menu** — catégories et produits via l'API Express (photos, descriptions, prix, allergènes), **modifiers** RestaurantOS (taille, base, suppléments, retrait). Produit désactivé → masqué immédiatement. **Chaque produit porte son taux de TVA** (5,5 / 10 / 20 %) et son **identifiant de correspondance caisse** (mapping module E).

**A3. Tunnel de commande** — panier persistant ; click & collect avec **créneau horaire** (A7) ou **livraison par code postal** (A8) ; coordonnées client (nom, téléphone obligatoire, email, adresse si livraison) ; **commande invité** ; champ « instructions ». **En mode livraison, le paiement en ligne est obligatoire** : aucun paiement à la livraison n'est proposé — sans paiement confirmé, pas de livraison.

**A4. Paiement en ligne** — Stripe Payment Element. Commande créée en `PENDING_PAYMENT` ; passage `CONFIRMED` uniquement après webhook `payment_intent.succeeded` signé. Email de confirmation. **La confirmation déclenche l'injection de la vente dans la caisse certifiée** (module E) avec mode de règlement « payé en ligne ».

**A5. Suivi client par token** — token unique à la confirmation ; page `/suivi/[token]` avec statut temps réel (Socket.io) : Reçue → En préparation → Prête → **En livraison** (si livraison) → Récupérée/Livrée. QR sur le reçu.

**A6. Fermetures exceptionnelles** — bascule back-office avec plage de dates et message ; blocage tunnel + bandeau site.

**A7. Créneaux click & collect** — modèle `TimeSlot`, capacité max par créneau ; créneaux complets ou passés indisponibles.

**A8. Zones de livraison** — codes postaux, frais, minimum de commande ; refus explicite hors zone.

### 4.2 Module B — POS caisse : APK sur tablette comptoir + impression Epson *(remanié v2.4)*

**B1. APK caisse (WebView résidente)** — APK Android légère chargeant `https://app.pizzeria.fr/pos`, **domaine verrouillé**, plein écran kiosque, sur **tablette Android standard** (WebView maintenue à jour via Play Store — contrairement au SUNMI bridé abandonné). L'APK maintient la WebView **résidente** (pas de rechargement volontaire en service) pour garantir le mode dégradé hors-ligne (voir B5).

**B2. Prise de commande sur place** — POS Next.js (`app.pizzeria.fr/app/(pos)/`) : grille produits adaptée à l'écran tablette (10"+), modifiers, panier, remises ; modes **sur place / à emporter** (les commandes en livraison proviennent exclusivement du site, déjà payées en ligne — pas de création de livraison au comptoir en V1) ; règlement espèces ou carte (TPE indépendant). Validation → `CONFIRMED` → **injection de la vente et de son règlement dans la caisse certifiée** (module E) → impression immédiate (ticket cuisine sur l'imprimante cuisine, reçu sur l'imprimante comptoir). Le numéro de ticket caisse est rattaché à la commande.

**B3. Réception commandes internet** — Socket.io : commande `CONFIRMED` → son + **impression automatique du ticket cuisine sur l'imprimante Epson cuisine** (déclenchée par le KDS, voir §4.3). Réimpression 24 h (tickets cuisine ; les duplicatas de reçus fiscaux relèvent de la caisse).

**B4. Impression (Epson ePOS-Print, 80 mm)** — remplace WebUSB/`react-to-print` du socle et le SDK SUNMI de la v2.3 :
- **Matériel** : 2 imprimantes thermiques **Epson TM** (ex. TM-m30III) en Ethernet ou Wi-Fi, IP fixes sur le LAN du restaurant — une au comptoir, une en cuisine.
- **Protocole** : **ePOS-Print (SDK JavaScript)** appelé depuis la WebView (APK caisse → imprimante comptoir ; APK KDS → imprimante cuisine). Contrainte HTTPS/certificat validée en §2.2.2 ; repli : **pont d'impression natif dans l'APK** (relais ESC/POS TCP 9100, sur le modèle du pont SUNMI de la v2.3).
- *Ticket cuisine* (non fiscal, imprimante cuisine) : n°, origine (EN LIGNE / COMPTOIR), créneau, articles + options, instructions.
- *Reçu client* (imprimante comptoir) : émis à partir des **données renvoyées par la caisse certifiée** (numéro de ticket caisse, ventilation TVA par taux, totaux, moyen de paiement) + SIRET + QR `/suivi/:token`. En cas d'indisponibilité de la caisse, voir B5.
- Gabarits configurables ; table **`PrintJob`** (traçabilité, réimpression, remontée des erreurs papier/capot via le statut ePOS).

**B5. Robustesse et mode dégradé** — reconnexion Socket.io ; box internet avec repli 4G recommandé. Deux cas distincts :
- **Coupure Internet, LAN local intact** (cas courant) : l'impression locale via ePOS **continue de fonctionner** (tablettes et imprimantes sur le même LAN). Prise de commande comptoir : file IndexedDB (portée depuis le socle) + impression locale ; synchronisation API Express au retour réseau, **puis injection différée dans la caisse certifiée** (file d'injection, horodatage d'origine transmis si l'API caisse le permet — à valider en §2.2.3 ; à défaut, procédure documentée de rattrapage sur la caisse). Pendant une coupure, le reçu imprimé porte la mention « ticket provisoire — reçu définitif disponible en caisse ». **Prérequis** : l'APK garde la session WebView active sans rechargement pendant la coupure — la file IndexedDB ne survit pas à un rechargement de page. **Hors périmètre V1** : service worker / PWA sur le POS. Si la WebView est rechargée pendant une coupure, le POS reste indisponible jusqu'au retour réseau (comportement accepté et testé en recette n° 6).
- **Coupure LAN / imprimante hors-ligne** : erreurs journalisées dans `PrintJob` avec alerte à l'écran ; réimpression au rétablissement.

### 4.3 Module C — KDS : APK sur tablette cuisine + imprimante Epson cuisine *(remanié v2.4)*

**APK KDS** (WebView résidente, domaine verrouillé, kiosque) chargeant `app.pizzeria.fr/app/(kds)/kitchen` sur tablette cuisine : colonnes temps réel (Socket.io), son à l'arrivée, changement de statut au toucher, propagation au suivi client, au POS comptoir et à l'APK livreur. Alertes retards par rapport au créneau. **Le KDS pilote l'imprimante Epson cuisine** : impression automatique du ticket de préparation à chaque commande `CONFIRMED` (en ligne et comptoir), réimpression à la demande.

### 4.4 Module D — Back-office gérant — **porté dans Next.js, étendu**

`app.pizzeria.fr/app/(admin)/` : menu, commandes, rapports, utilisateurs (dont rôle livreur), réglages. Extensions : horaires, fermetures exceptionnelles, créneaux, zones livraison, gabarits tickets, **configuration des imprimantes (IP, affectation comptoir/cuisine, test d'impression)**, export CSV, **écran de supervision des injections caisse** (module E : statut par commande, erreurs, file de rejeu, mapping catalogue). Les rapports de la plateforme sont **indicatifs** (pilotage opérationnel) ; les documents fiscaux (Z, TVA) font foi côté caisse. Modules hors périmètre masqués par feature flags.

### 4.5 Module E — Intégration caisse certifiée

Développé dans `server/` (service dédié + worker de file). Périmètre :

**E1. Mapping catalogue** — table de correspondance `MenuItem`/`ModifierOption` ↔ articles/options de la caisse, **taux de TVA par produit** ; écran d'administration du mapping (module D) ; contrôle de complétude (produit actif sans correspondance = alerte bloquante à la mise en vente).

**E2. Injection des ventes** — à chaque commande `CONFIRMED` : création de la commande dans la caisse via API (articles, options, remises, ventilation TVA) + **enregistrement du règlement** (espèces / carte TPE / payé en ligne). Récupération et stockage du **numéro de ticket caisse** sur l'`Order` (affiché sur le reçu B4 et dans le CRM).

**E3. File d'injection et rejeu** — injection **asynchrone et fiable** : file persistante (table `CashRegisterJob` : payload, tentatives, statut, erreur), retries avec backoff, idempotence (clé d'idempotence par commande pour éviter les doublons en caisse). L'indisponibilité momentanée de la caisse **ne bloque jamais** la prise de commande ni la cuisine ; les ventes sont injectées dès rétablissement. Alerte back-office si la file dépasse un seuil ou un délai.

**E4. Réconciliation** — rapport quotidien automatique : total des ventes `CONFIRMED` de la plateforme vs total injecté en caisse (par mode de règlement) ; écarts signalés au gérant avant clôture Z. Export CSV de contrôle pour l'expert-comptable.

**E5. Mode dégradé** — cf. B5 : injection différée avec horodatage d'origine si supporté, sinon procédure de rattrapage documentée (formation gérant).

**E6. Annulations / avoirs** — une commande annulée après injection déclenche l'opération inverse via API caisse si disponible ; à défaut, l'annulation est signalée au gérant pour saisie sur la caisse (procédure documentée). Aucune suppression silencieuse côté plateforme d'une vente déjà injectée.

*Les capacités exactes (règlements via API, horodatage, annulations) dépendent de la caisse retenue et sont validées en §2.2.3 ; le présent périmètre est ajusté en conséquence à l'issue de la phase 0.*

### 4.6 Module F — APK livreur *(nouveau v2.4)*

**APK livreur** (WebView, domaine verrouillé) chargeant `app.pizzeria.fr/app/(livreur)/` sur smartphone Android :

**F1. File de livraison** — liste temps réel des commandes en mode livraison au statut `READY`, avec adresse, téléphone client, montant (à titre d'information), instructions. **Une commande en livraison est nécessairement déjà payée en ligne** (`CONFIRMED` via webhook Stripe — §A3) : le livreur ne transporte que des produits payés et **ne manipule aucun encaissement** ; une commande non payée ne peut pas atteindre la file de livraison.

**F2. Tournée** — prise en charge d'une commande → statut **`OUT_FOR_DELIVERY`** (propagé au KDS, au POS et au suivi client `/suivi/:token`) ; ouverture de l'itinéraire par intent Google Maps ; bouton « Livrée » → `COMPLETED` ; appel client en un tap.

**F3. Accès** — authentification JWT avec rôle **livreur** (accès limité aux livraisons du jour, pas d'accès admin/POS/KDS). Fonctionne en 4G (pas de dépendance au LAN du restaurant ; aucune impression côté livreur).

*V1 volontairement minimal : pas de géolocalisation temps réel du livreur, pas d'optimisation de tournée multi-commandes, pas d'encaissement à la livraison (paiement en ligne uniquement pour la livraison).*

---

## 5. Flux de commande (résumé)

**Commande en ligne :** panier Next.js (`pizzeria.fr`) → API Express : `PENDING_PAYMENT` → Stripe → webhook signé → `CONFIRMED` → **injection caisse certifiée (règlement « payé en ligne », n° ticket caisse en retour)** → Socket.io → tablette KDS (+ impression auto du ticket cuisine sur l'imprimante Epson cuisine) + notification tablette caisse → statuts cuisine → *(si livraison)* `READY` → APK livreur : `OUT_FOR_DELIVERY` → `COMPLETED` → suivi `/suivi/:token` à chaque étape.

**Commande comptoir :** APK caisse sur tablette comptoir (`app.pizzeria.fr/pos`) → règlement espèces ou carte TPE → API Express : `CONFIRMED` → **injection caisse certifiée (vente + règlement)** → impression du reçu (imprimante comptoir, avec n° ticket caisse) + ticket cuisine (imprimante cuisine via KDS) → même chaîne de statuts.

**Registre fiscal :** dans les deux flux, la caisse certifiée enregistre 100 % des ventes ; ses clôtures Z et sa ventilation TVA constituent la source comptable unique.

---

## 6. Architecture technique

### 6.1 Structure du monorepo

```
RestaurantOS/
├── server/                 # Express + Prisma + Socket.io + webhooks Stripe
│   ├── prisma/
│   └── src/cash-register/  # Module E : client API caisse + file d'injection (worker)
├── app.pizzeria.fr/        # Next.js — TOUTE l'UI (public, POS, KDS, livreur, admin)
│   ├── middleware.ts       # Routage par en-tête Host
│   └── app/
│       ├── (public)/       # servi sur pizzeria.fr
│       ├── (pos)/          # servi sur app.pizzeria.fr — APK caisse (tablette comptoir)
│       ├── (kds)/          # servi sur app.pizzeria.fr — APK KDS (tablette cuisine)
│       ├── (livreur)/      # servi sur app.pizzeria.fr — APK livreur (smartphone)
│       └── (admin)/        # servi sur app.pizzeria.fr
├── android/                # Projet APK WebView unique — 3 variantes de build (flavors) :
│                           #   caisse (pos), kds, livreur — domaine verrouillé, kiosque
├── client/                 # LEGACY Vite — ne plus développer, exclu build/CI/Docker
└── docker-compose.yml      # prod : postgres + server + app.pizzeria.fr
```

Les trois APK partagent le **même projet Android** (une base WebView commune, trois *product flavors* qui ne diffèrent que par l'URL de départ, l'icône et le verrouillage kiosque) — le surcoût par APK supplémentaire est marginal.

**Routage multi-domaines (obligatoire)** — `pizzeria.fr` et `app.pizzeria.fr` pointent vers le **même conteneur** Next.js. Un **`middleware.ts`** route selon l'en-tête `Host` :

- `Host: pizzeria.fr` → réécriture vers les routes `(public)/` uniquement ; accès `(pos)|(kds)|(livreur)|(admin)` refusé (redirect ou 404).
- `Host: app.pizzeria.fr` → routes opérationnelles `(pos)`, `(kds)`, `(livreur)`, `(admin)` ; pas de tunnel commande public sur ce domaine.

### 6.2 Environnements

**Développement local (Laragon)** — pas de Docker, pas de Traefik :

| Service | URL locale | Port |
|---------|------------|------|
| PostgreSQL | Laragon | 5432 |
| API Express | `http://api.pizzeria.test` ou `localhost:3001` | 3001 |
| Next.js UI | `http://app.pizzeria.test` ou `localhost:3000` | 3000 |
| Site public | `http://pizzeria.test` (même Next.js, vhost Laragon) | 3000 |
| Imprimantes Epson | simulateur ePOS / imprimante de test sur le LAN dev | — |
| Caisse certifiée | **sandbox éditeur** (ou mock du client API caisse) | — |

Variables locales : `DATABASE_URL`, `NEXT_PUBLIC_API_URL=http://api.pizzeria.test`, `JWT_SECRET`, `STRIPE_*`, `CASH_REGISTER_*` (URL API, clés, identifiant établissement). Les IP des imprimantes sont configurées dans le back-office (module D), pas en variables d'environnement.

**Parité PostgreSQL** — même version **majeure** entre PostgreSQL Laragon (dev) et conteneur Docker (prod), ex. **PostgreSQL 16**. Les migrations Prisma sont testées sur les deux. **La recette finale (§9) s'exécute sur l'environnement Docker de préproduction/production**, avec la **caisse certifiée réelle du client** (ou sa sandbox de production), les **imprimantes Epson réelles** et les **APK installées sur le matériel réel**.

**Production (VPS Hostinger — Docker + Traefik)** :

```
Internet
    │
    ▼
Traefik (stack existante sur le VPS — Let's Encrypt, labels Docker)
    │
    ├── pizzeria.fr              → conteneur app.pizzeria.fr (Next.js :3000)
    ├── app.pizzeria.fr          → conteneur app.pizzeria.fr (même Next.js)
    └── api.pizzeria.fr          → conteneur server (Express :3001)
              │
              ├── postgres (réseau interne Docker, port non exposé)
              └── API caisse certifiée (sortie HTTPS vers le cloud de l'éditeur)

LAN restaurant (indépendant du VPS)
    ├── Tablette comptoir (APK caisse) ──ePOS──▶ Imprimante Epson comptoir (IP fixe)
    ├── Tablette cuisine  (APK KDS)    ──ePOS──▶ Imprimante Epson cuisine  (IP fixe)
    └── Smartphone livreur (APK livreur) — 4G/Wi-Fi, pas d'imprimante
```

Traefik : réseau Docker externe `traefik` ; labels sur les conteneurs `app` et `server` ; **pas de service Caddy** dans le compose. **L'impression est locale au restaurant** (APK → imprimante sur le LAN) : elle ne transite pas par le VPS.

### 6.3 Choix techniques

| Composant | Choix | Statut |
|---|---|---|
| UI (public + POS + KDS + livreur + admin) | **Next.js App Router** (`app.pizzeria.fr/`) | À construire / porter depuis `client/` |
| Frontend legacy | ~~Vite + react-router~~ (`client/`) | **Abandonné** — exclu build Docker et CI |
| i18n UI | **next-intl** (`app.pizzeria.fr/`) | À mettre en place |
| Routage multi-domaines | **middleware.ts** (routage par `Host`) | À construire |
| API métier | **Express + Prisma + Socket.io + Stripe** (`server/`) | Socle adapté |
| **Registre fiscal** | **Caisse certifiée** (Zelty ou équivalent), intégrée via API (module E) | **Choix client en phase 0** |
| Base de données | **PostgreSQL** (Laragon local, Docker prod) | Migration depuis SQLite |
| Auth staff | **JWT du socle** (bcrypt, rate limiting, rôles admin/employé/**livreur**) | Conservé + rôle livreur |
| Temps réel | **Socket.io** | Conservé |
| Paiement en ligne | **Stripe** (Payment Element + webhooks signés sur Express) | Socle, branché au tunnel Next.js |
| **APK WebView** *(remanié v2.4)* | Projet Android unique, **3 flavors : caisse, KDS, livreur** (WebView résidente, domaine verrouillé, kiosque) — plus aucun support SUNMI | À construire |
| **Matériel point de vente** *(nouveau v2.4)* | **2 tablettes** Android standard (comptoir + cuisine, GMS/WebView à jour) + **smartphone livreur** + **2 imprimantes Epson TM** (LAN, IP fixes) | **À acquérir par le client** (validation modèles en phase 0) |
| **Impression** *(remanié v2.4)* | **Epson ePOS-Print (SDK JS)** depuis les APK ; repli pont natif ESC/POS (TCP 9100) dans l'APK | À construire (§2.2.2) |
| Reverse proxy prod | **Traefik** (VPS Hostinger, labels Docker) | Existant côté infra |
| Sauvegardes | `pg_dump` quotidien + copie chiffrée hors VPS | À mettre en place |

### 6.4 Feature flags

Variable `ENABLED_MODULES`. **Actifs V1 :** menu, POS, kitchen, **livreur**, commandes, rapports, utilisateurs, réglages, **cash-register (module E)**. **Désactivés V1 :** wifi, tables, réservations, fidélité, shifts, dépenses, licences. Désactivation = nav masquée + routes API 404/403.

### 6.5 Modèle de données

Socle RestaurantOS conservé : `Business`, `User`, `MenuCategory`, `MenuItem`, `MenuModifier`, `ModifierOption`, `Order`, `OrderItem`, plus tables dormantes. **Modifications :** centimes (entiers) ; `PENDING_PAYMENT` et `OUT_FOR_DELIVERY` ; **taux de TVA par `MenuItem`** ; **`cashRegisterRef` (mapping) sur `MenuItem`/`ModifierOption`** ; **`cashRegisterTicketId` sur `Order`** ; rôle **livreur** sur `User`. **Ajouts :** `TimeSlot`, `DeliveryZone`, `PrintJob` (avec imprimante cible comptoir/cuisine), **`CashRegisterJob`** (file d'injection : payload, idempotence, tentatives, statut, erreur), `trackingToken` sur `Order`, fermetures exceptionnelles et **configuration des imprimantes** dans les réglages.

Statuts : `PENDING_PAYMENT → CONFIRMED → PREPARING → READY → (OUT_FOR_DELIVERY si livraison) → COMPLETED` (+ `CANCELLED`).

---

## 7. Exigences non fonctionnelles

- **Conformité fiscale** : 100 % des ventes encaissées (comptoir + web) enregistrées dans la caisse certifiée ; réconciliation quotidienne (E4) ; reçu client fiscal issu des données caisse ; la preuve de conformité de la caisse (certificat d'organisme accrédité ou attestation individuelle de l'éditeur — §2bis.1, périmètre API inclus) est conservée par le client ; schéma de flux validé par l'expert-comptable du client en phase 0. La plateforme n'émet aucun document se substituant aux documents fiscaux de la caisse.
- **Sécurité** : HTTPS via Traefik ; aucune donnée bancaire sur serveur/site/tablettes ; **clés API caisse stockées côté serveur uniquement** (jamais exposées au front/POS) ; routes modules désactivés neutralisées ; APK verrouillées sur le domaine ; rôle livreur à privilèges réduits ; imprimantes non exposées hors du LAN ; audit §2.2 appliqué ; `npm audit` sans critique à la livraison.
- **Matériel** *(remplace « Compatibilité SUNMI V2 »)* : tablettes et smartphone Android standard avec services Google et **WebView à jour via Play Store** — plus aucun matériel bridé type SUNMI ; imprimantes Epson TM compatibles ePOS-Print, IP fixes sur le LAN ; recette sur matériel réel (§2.2.2 et §9).
- **Performance** : commande visible sur la tablette KDS < 3 s après confirmation ; impression < 5 s ; injection caisse asynchrone (n'ajoute aucune latence perçue) ; Lighthouse > 90 (site public mobile).
- **Disponibilité** : `restart: always` ; monitoring (Uptime Kuma) ; **l'indisponibilité de la caisse ou de son API ne bloque ni la prise de commande ni la cuisine** (file E3), seule l'injection est différée.
- **Mode dégradé** : coupure Internet avec LAN intact → impression locale maintenue + file IndexedDB tant que la WebView APK reste chargée (§4.2 B5) ; injection caisse différée avec rattrapage tracé ; restauration < 1 h depuis sauvegarde.
- **RGPD** : mentions légales, politique de confidentialité, consentement cookies, minimisation des données, purge/anonymisation commandes > 3 ans (hors obligations de conservation comptable portées par la caisse), **registre des traitements** (incluant le transfert des données de vente vers l'éditeur de la caisse — à mentionner dans la politique de confidentialité ; adresses de livraison visibles par le livreur limitées au jour courant).
- **Licence** : notice MIT RestaurantOS conservée ; fichier `NOTICE`.

---

## 8. Livrables

1. Monorepo Git : `server/` adapté (dont module E `cash-register/`), `app.pizzeria.fr/` Next.js (public, POS, KDS, livreur, admin), projet `android/` (**3 APK : caisse, KDS, livreur**).
2. **Rapport d'audit** du socle (§2.2.1), **rapport de validation de la chaîne d'impression Epson** (§2.2.2 : modèles, HTTPS/TLS, statuts) et **rapport de validation API caisse** (§2.2.3 : capacités, périmètre de la preuve de conformité, limites, choix retenu).
3. `docker-compose.yml` (postgres + server + app.pizzeria.fr, labels Traefik), scripts sauvegarde/restauration, doc installation VPS, **doc d'installation du matériel en boutique** (installation des APK, IP fixes imprimantes, certificats TLS imprimantes le cas échéant).
4. Interface intégralement en français (**next-intl**) ; montants en EUR (centimes) ; TVA multi-taux par produit.
5. Documentation d'exploitation gérant, **incluant les procédures caisse** (réconciliation quotidienne, rattrapage après coupure, annulations/avoirs, conservation de la preuve de conformité de la caisse) et **procédures imprimantes** (bourrage, changement de rouleau, test d'impression).
6. Jeu de tests de recette (§9).

*À la charge du client (hors livrables prestataire) : souscription et paramétrage de la caisse certifiée auprès de son éditeur ; conservation de la preuve de conformité (certificat ou attestation éditeur) ; validation du dispositif par son expert-comptable ; **acquisition du matériel** (2 tablettes, smartphone livreur, 2 imprimantes Epson TM — modèles validés en phase 0).*

---

## 9. Recette (critères d'acceptation clés)

1. Commande payée en ligne : `PENDING_PAYMENT → CONFIRMED` via webhook Stripe ; affichage tablette KDS + impression automatique du ticket cuisine (imprimante Epson cuisine) < 3 s avec son ; **vente présente dans la caisse certifiée avec règlement « payé en ligne » et n° de ticket caisse rattaché**.
2. Paiement abandonné : reste `PENDING_PAYMENT`, invisible cuisine/POS, non imprimée, **non injectée en caisse**.
3. Commande comptoir sur l'APK caisse (espèces puis carte) : ticket cuisine (imprimante cuisine) + reçu client (imprimante comptoir) portant le **n° de ticket caisse** et la **ventilation TVA par taux** + affichage KDS ; vente et règlement présents en caisse.
4. Suivi `/suivi/:token` temps réel jusqu'à « Prête » (retrait) ou « Livrée » (livraison).
5. Créneau plein indisponible ; code postal hors zone refusé.
6. Coupure Internet avec LAN intact (APK résidente, **sans rechargement**) : prise de commande locale + impression locale OK (mention « ticket provisoire ») ; synchronisation au retour réseau **et injection différée en caisse tracée** (`CashRegisterJob`). Scénario « rechargement pendant coupure → POS indisponible jusqu'au réseau » documenté comme comportement attendu V1.
7. Indisponibilité de l'API caisse (simulation) : prise de commande et cuisine non bloquées ; file d'injection en attente + alerte back-office ; rejeu automatique au rétablissement **sans doublon** (idempotence).
8. **Réconciliation** : le total quotidien plateforme = total injecté caisse par mode de règlement ; rapport E4 conforme ; ticket **Z de la caisse** cohérent avec le CA de la journée de test (web + comptoir).
9. Annulation d'une commande déjà injectée : opération inverse en caisse (ou procédure documentée exécutée) ; aucune divergence résiduelle.
10. Produit multi-taux : pizza à emporter (10 %), boisson alcoolisée (20 %), produit à 5,5 % — ventilation TVA exacte sur le reçu et en caisse.
11. Fermeture exceptionnelle : tunnel bloqué + bandeau site.
12. Modules désactivés : API 404/403, nav absente.
13. Interface 100 % française ; montants EUR au centime.
14. Restauration base depuis sauvegarde veille réussie.
15. Impression Epson réelle conforme sur les deux imprimantes (comptoir + cuisine) ; réimpression ticket cuisine ; **erreur papier/capot remontée** (`PrintJob` + alerte à l'écran) ; imprimante débranchée → alerte, réimpression au rétablissement.
16. Les 3 APK (caisse, KDS, livreur) installées et validées sur le matériel réel : domaine verrouillé, kiosque, session résidente tenue une journée de service, impression ePOS fonctionnelle depuis la WebView HTTPS (§2.2.2 confirmé en recette).
17. **Parcours livreur** : commande livraison `READY` → visible sur l'APK livreur → prise en charge `OUT_FOR_DELIVERY` (propagée au KDS et au suivi client) → « Livrée » → `COMPLETED` ; itinéraire Google Maps ouvert depuis la fiche ; compte livreur sans accès admin/POS/KDS ; **aucune commande livraison non payée en ligne ne peut apparaître dans la file du livreur** (tentative en `PENDING_PAYMENT` invisible).
18. **Preuve de conformité de la caisse** (certificat d'organisme accrédité ou attestation individuelle de l'éditeur) en cours de validité remise au client, périmètre couvrant l'ingestion API (vérifié en phase 0, confirmé à la livraison).

---

## 10. Planning

| Phase | Contenu | Durée |
|---|---|---|
| 0 | **Go/no-go** : audit socle (§2.2.1) + validation chaîne d'impression Epson (§2.2.2) + **choix caisse certifiée et validation API** (§2.2.3, avec le client et son expert-comptable) | 2–3 j |
| 1 | Adaptations API : PostgreSQL 16, centimes, mono-tenant, `PENDING_PAYMENT`/`OUT_FOR_DELIVERY`, TVA multi-taux, rôle livreur, feature flags | 3 j |
| 2 | Scaffold `app.pizzeria.fr/` + middleware Host + port POS/KDS/admin depuis `client/` | 4–6 j |
| 3 | Français + EUR (**next-intl**) | 1 j |
| 4 | **APK (3 flavors : caisse, KDS, livreur)** + **impression Epson ePOS** (comptoir + cuisine), gabarits, `PrintJob`, configuration imprimantes en back-office | 4–6 j |
| 4bis | **Module E — intégration caisse certifiée** : client API, mapping catalogue, file d'injection idempotente, réconciliation, écran de supervision | 3–5 j |
| 5 | Site public `(public)/` : landing SEO, menu, tunnel, Stripe | 5–8 j |
| 6 | Créneaux + zones + token suivi + fermetures | 4–5 j |
| 6bis | **Parcours livreur** : route `(livreur)`, file de livraison, statuts, propagation suivi client | 2–3 j |
| 7 | Déploiement VPS (Compose, Traefik, sauvegardes) + installation matériel boutique (APK, imprimantes), **recette sur Docker avec caisse réelle/sandbox et imprimantes réelles**, formation (dont procédures caisse et imprimantes) | 2–3 j |

**Total indicatif : 30 à 43 jours ouvrés, soit environ 6 à 8,5 semaines** (somme des phases, travail séquentiel). *Vs v2.3 (28–40 j) : le surcoût vient du **parcours livreur** (nouveau, +2–3 j) ; l'abandon du SUNMI est neutre (l'APK unique multi-flavors remplace l'APK SUNMI, l'impression ePOS remplace le pont SunmiPrinter).*

*Note : un chevauchement partiel est possible (ex. phases 5 et 4/4bis en parallèle si deux intervenants) — peut ramener vers **5 à 7 semaines** en configuration optimale, sans garantie contractuelle. La phase 4bis dépend de la disponibilité de la sandbox de l'éditeur de caisse (à sécuriser dès la phase 0) ; la phase 4 dépend de la disponibilité d'une imprimante Epson de test (à acquérir dès la phase 0).*

Comparatif : v1.0 from scratch = 9–13 semaines ; v2.x socle RestaurantOS = réduction d'environ **40 à 50 %** du délai v1.0. L'option de repli « module ISCA en propre » (§2bis.4) ajouterait 5–8 j au présent planning et transférerait la responsabilité réglementaire au prestataire.

No-go audit (§2.2.1) → retour planning v1.0. No-go impression (§2.2.2) → changement de modèle d'imprimante ou pont natif APK, reste du projet poursuivable. No-go caisse (§2.2.3) → arbitrage client : autre éditeur de caisse ou **activation de l'option de repli conservée** (module ISCA en propre, avenant §2bis.4) — le projet aboutit à une solution conforme dans tous les cas.

---

## 11. Coûts pour le client

### 11.1 Investissement matériel initial *(nouveau v2.4)*

- **2 tablettes Android** standard 10"+ avec services Google (comptoir + cuisine) : ~150–350 € l'unité selon gamme.
- **1 smartphone Android** pour le livreur (ou téléphone existant compatible).
- **2 imprimantes thermiques Epson TM** (ex. TM-m30III, Ethernet/Wi-Fi, 80 mm) : ~300–450 € HT l'unité.
- Supports/coques antichoc, rouleaux 80 mm, câblage réseau le cas échéant.

*Modèles exacts validés en phase 0 (§2.2.2). Ce matériel remplace le terminal SUNMI V2 de la v2.3, qui n'est plus utilisé par la solution (système bridé non maintenable).*

### 11.2 Coûts récurrents

- **Caisse certifiée** (Zelty ou équivalent) : abonnement de l'ordre de **30 à 90 €/mois** selon l'éditeur et l'offre, + frais éventuels d'accès API / programme partenaire (à chiffrer en phase 0). *Poste imposé par l'obligation légale art. 286 CGI ; inclut les mises à jour réglementaires et le maintien de la preuve de conformité par l'éditeur.*
- VPS Hostinger : ~5–15 €/mois · Domaine : ~10 €/an · Stripe : commission par transaction · Email transactionnel (confirmation de commande) : offre gratuite ou < 10 €/mois selon volume · Forfait 4G du smartphone livreur · Papier 80 mm.
- **Aucun abonnement logiciel pour la plateforme développée** (site, POS, KDS, livreur, CRM).

---

## 12. Évolutions futures (V2+)

Réactivation modules dormants par feature flag ; TPE protocolaire ; SMS « commande prête » ; imprimante supplémentaire (second poste de préparation) ; PWA/service worker pour un mode hors-ligne résistant au rechargement ; géolocalisation temps réel du livreur et optimisation de tournée ; encaissement à la livraison (TPE mobile, à injecter en caisse) ; 2e point de vente (multi-tenant, multi-établissement côté caisse) ; exploitation avancée des données caisse (marges, food cost) si l'API de l'éditeur le permet.
