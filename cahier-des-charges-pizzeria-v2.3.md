# Cahier des charges — Solution digitale de commande et d'encaissement pour pizzeria

**Version :** 2.3 — Juillet 2026
**Statut :** Draft pour validation client
**Évolution majeure vs v1.0 :** le développement s'appuie sur le projet open source **RestaurantOS** (licence MIT) comme socle applicatif, adapté et étendu, au lieu d'un développement intégral from scratch. Délai et coût réduits par rapport au from scratch (v1.0 : 9–13 semaines).

**Évolution v2.0 → v2.1 :** abandon de Vite ; toute l'UI dans **Next.js** (`app.pizzeria.fr/`) ; API **Express** (`server/`) ; **Traefik** (VPS Hostinger) ; dev local **Laragon**.

**Évolution v2.1 → v2.2 :** prérequis WebView ≥ 64 (phase 0 bloquante) ; planning recalculé ; middleware routage par hôte ; mode dégradé POS clarifié (APK résidente) ; parité PostgreSQL Laragon/Docker ; i18n **next-intl** ; `client/` exclu du build/CI.

**Évolution v2.2 → v2.3 (conformité fiscale) :** mise en conformité avec la loi anti-fraude à la TVA (art. 286, I-3° bis du CGI — critères ISCA) par **intégration API vers une caisse enregistreuse certifiée** (NF525/LNE, type Zelty ou équivalent) **que le client doit acquérir**. La plateforme développée (site, POS SUNMI, KDS, back-office/CRM) est un **système d'orchestration et de prise de commande** ; la caisse certifiée est le **registre fiscal unique** de tous les encaissements (comptoir espèces/carte et ventes en ligne Stripe). Aucun module fiscal ISCA n'est développé en propre ; aucune attestation de conformité n'est délivrée par le prestataire. Nouveau module E (intégration caisse), phase 0 étendue (choix caisse + validation API), planning et coûts récurrents recalculés.

---

## 1. Contexte et objectifs

Le client, une pizzeria, souhaite se doter d'une solution unifiée permettant de gérer les commandes passées **en ligne** (site web) et **sur place** (en boutique), avec impression automatique des tickets de préparation sur son terminal SUNMI V2, **en conformité avec la réglementation française sur les logiciels de caisse**.

### Objectifs

1. Offrir aux clients finaux un site web vitrine avec commande en ligne (click & collect et/ou livraison), avec paiement en ligne.
2. Centraliser toutes les commandes (en ligne + sur place) dans un back-office unique.
3. Afficher les commandes en temps réel sur une **tablette en cuisine/comptoir** (écran de suivi).
4. Utiliser le **SUNMI V2** comme point de prise de commande sur place et comme **imprimante de tickets** pour toutes les commandes (locales et internet).
5. Minimiser les coûts récurrents : hébergement sur VPS unique au nom de domaine du client ; **pas d'abonnement SaaS pour la plateforme développée**. *Amendé en v2.3 :* l'abonnement à la **caisse certifiée** (§2bis) est accepté car il répond à une **obligation légale** (art. 286 CGI) que la plateforme ne porte pas elle-même.
6. **Capitaliser sur l'open source** : socle RestaurantOS (MIT) audité puis adapté, afin de réduire les délais et le coût de développement.
7. **Garantir la conformité fiscale** de l'ensemble des encaissements (espèces, carte TPE, paiement en ligne Stripe) via l'enregistrement systématique des ventes dans la caisse certifiée du client (§2bis, module E).

### Hors périmètre (V1)

- Intégration protocolaire avec le TPE bancaire (paiement sur place sur TPE indépendant, saisie manuelle du montant).
- Programme de fidélité, gestion des stocks, comptabilité.
- Application mobile native grand public (le site est responsive).
- **Développement d'un module fiscal ISCA en propre** (inaltérabilité, chaînage cryptographique, clôtures Z, journal des événements techniques, archivage fiscal) : cette responsabilité est **portée par la caisse certifiée** et son éditeur. Le prestataire ne délivre **aucune attestation individuelle de conformité** au sens du BOFiP ; la preuve de conformité (certificat NF525/LNE ou attestation de l'éditeur de la caisse) est fournie par l'éditeur de la caisse au client.
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

**2.2.2 Faisabilité WebView SUNMI V2** (sur l'appareil réel du client) — mesure de la version Chrome/WebView installée. **Condition de faisabilité du POS Next.js sur V2 : WebView ≥ 64** (mise à jour via Play Store / Android System WebView si GMS disponible). Une WebView d'usine Android 7.1 (Chromium ~52–58) **ne peut pas exécuter Next.js moderne** (plancher runtime Next.js ≈ Chrome 64 ; `browserslist` n'abaisse pas ce seuil). En cas de WebView < 64 non corrigeable : **no-go POS sur ce V2** → remplacement matériel ou appareil de secours (engagement contractuel explicite).

**2.2.3 Choix et validation de la caisse certifiée** *(nouveau v2.3)* — sélection avec le client de la caisse certifiée (Zelty ou équivalent, voir §2bis.3) et **validation technique de son API** avant tout développement du module E :
- certificat NF525 ou LNE **en cours de validité**, dont le **périmètre couvre l'ingestion de commandes externes via API** (canal « commande en ligne / partenaires ») — motif classique de non-conformité : certificat général ne couvrant pas le module d'injection ;
- capacités API requises : création de commande avec détail articles/options, **ventilation TVA multi-taux** (5,5 / 10 / 20 %), remises, **enregistrement du règlement** (espèces, carte TPE, « payé en ligne ») ou à défaut circuit de validation du règlement sur la caisse ; idéalement horodatage d'origine pour la resynchronisation du mode dégradé ;
- conditions d'accès : coût de l'abonnement, frais éventuels d'accès API / programme partenaire, environnement de test (sandbox) disponible ;
- compatibilité matérielle : certaines caisses certifiées tournent sur matériel SUNMI — à évaluer (scénario « caisse certifiée sur le V2 » vs « caisse sur poste dédié »).

**Conséquences d'un no-go :** échec audit code (2.2.1) → repli sur le plan « from scratch » v1.0. Échec WebView (2.2.2) → seul le POS WebView V2 est bloqué jusqu'à résolution matérielle ; le reste du projet poursuit. Absence de caisse certifiée à API adéquate acceptée par le client (2.2.3) → **le module E est remplacé par le développement d'un module fiscal ISCA en propre** (avenant : +5 à 8 j, attestation individuelle du prestataire, responsabilité d'éditeur — option non recommandée, voir §2bis.4).

### 2.3 Adaptations du socle (arbitrages actés)

| # | Sujet | RestaurantOS d'origine | Décision | Effort |
|---|---|---|---|---|
| A1 | Base de données | SQLite | **Migration PostgreSQL** (Laragon en local, conteneur Docker en prod) ; régénération des migrations Prisma | ½ j |
| A2 | Montants | Prix en `Float` | **Conversion en entiers (centimes)** à l'occasion de la refonte des migrations (A1) | inclus A1 |
| A3 | Multi-tenant | `businessId` sur toutes les entités | **Conservé et neutralisé** : un seul `Business` créé au seed, identifiant fixé en variable d'environnement (`BUSINESS_ID`) | qq h |
| A4 | Authentification | JWT custom (bcrypt, rate limiting, rôles) | **Conservé** — audit du JWT inclus dans le jalon §2.2. Commande en ligne en invité → pas de compte client en V1 | 0 (+2 h audit) |
| A5 | Temps réel | Socket.io | **Conservé** — reconnexion automatique et fallbacks compatibles WebView SUNMI V2 | 0 |
| A6 | Langue / devise | Bilingue AR/EN, i18next | **Français uniquement**, devise **EUR** (centimes). i18n UI : **next-intl** dans `app.pizzeria.fr/` | 1 j |
| A7 | Statuts de commande | PENDING → PREPARING → READY → … | **Ajout de `PENDING_PAYMENT`** : commande en ligne → `PENDING_PAYMENT` → webhook Stripe `payment_intent.succeeded` (signature vérifiée) → `CONFIRMED` (push temps réel + impression + **injection caisse**). Commandes comptoir → `CONFIRMED` directement | 1 j |
| A8 | Modules hors périmètre | WiFi, tables, réservations, fidélité, shifts, dépenses, licences actifs | **Feature flags** (`ENABLED_MODULES`) : navigation masquée et routes API désactivées (404/403). Code et tables conservés | ½ j |
| A9 | Frontend | SPA **Vite** + `react-router` (`client/`) | **Remplacé par Next.js App Router** dans `app.pizzeria.fr/` — port des composants React existants. **Vite interdit**. POS SUNMI : Client Components ; **WebView Chrome ≥ 64 obligatoire** | 4–6 j |
| A10 | Reverse proxy | Caddy (socle d'origine) | **Traefik** sur le VPS Hostinger (stack Docker existante, réseau externe `traefik`) | ½ j |
| A11 | **Conformité fiscale** *(nouveau v2.3)* | Aucune (socle non conforme art. 286 CGI pour la France) | **Intégration API caisse certifiée** (module E) : toute vente encaissée (comptoir et web) est enregistrée dans la caisse certifiée du client. La plateforme n'enregistre pas d'encaissement faisant foi fiscalement | 3–5 j |

---

## 2bis. Conformité fiscale — architecture « caisse certifiée » *(nouveau v2.3)*

### 2bis.1 Rappel du cadre légal

Tout assujetti à la TVA qui enregistre les règlements de clients particuliers au moyen d'un logiciel ou système de caisse doit utiliser un système satisfaisant aux conditions d'**inaltérabilité, sécurisation, conservation et archivage** des données (critères ISCA — art. 286, I-3° bis du CGI). La preuve est apportée par un **certificat NF525/LNE** délivré par un organisme accrédité ou une **attestation individuelle de l'éditeur** (mécanisme rétabli par la loi n° 2026-103 du 19 février 2026, art. 125). Sanction : amende de **7 500 € par logiciel non conforme** (art. 1770 duodecies CGI), 60 jours pour régulariser.

Le TPE bancaire ne trace que les paiements carte ; Stripe ne trace que le flux monétaire en ligne. Ni l'un ni l'autre n'enregistre la **vente** (détail articles, ventilation TVA) : seul un système de caisse conforme peut le faire. La pizzeria acceptant les espèces, l'obligation s'applique pleinement.

### 2bis.2 Principe d'architecture retenu

Séparation stricte des responsabilités, sur le modèle éprouvé des intégrateurs du marché (totems, click & collect, agrégateurs) :

- **La plateforme développée** (site public, POS SUNMI, KDS, back-office/CRM) = **prise de commande, orchestration cuisine, suivi client, statistiques**. Elle ne constitue pas le registre fiscal des encaissements. Les logiciels de gestion ne sont pas visés par l'obligation dès lors que la brique « gestion des règlements » est portée par un système conforme ; l'export/l'échange de données avec la caisse ne contamine pas la plateforme.
- **La caisse certifiée du client** (Zelty ou équivalent) = **registre fiscal unique**. Toutes les ventes y sont enregistrées via API : commandes comptoir (règlement espèces ou carte TPE) et commandes web (règlement « payé en ligne » / Stripe). Journal fiscal, clôtures Z, ventilation TVA, archivage : portés par la caisse et garantis par son éditeur (certificat + mises à jour réglementaires).

**Trois conditions structurantes (engagements de conception) :**
1. **Exhaustivité** — 100 % des encaissements (espèces comprises) sont enregistrés dans la caisse. Le POS SUNMI ne « déclare » plus un règlement dans la seule base de la plateforme : la validation d'une commande comptoir déclenche l'enregistrement de la vente et de son règlement dans la caisse.
2. **Ventes web incluses** — toute commande `CONFIRMED` par webhook Stripe est injectée dans la caisse avec le mode de règlement « paiement en ligne », afin que les clôtures Z et la déclaration de TVA reflètent la totalité du chiffre d'affaires (une seule source pour l'expert-comptable).
3. **Reçu client fiscal issu de la caisse** — le reçu remis au client (ventilation TVA, totaux) est émis par la caisse, ou imprimé sur le SUNMI **à partir des données et du numéro de ticket renvoyés par la caisse**. Les tickets **cuisine** (documents de préparation, non fiscaux) restent imprimés directement par la plateforme sans contrainte.

### 2bis.3 Choix de la caisse (à arbitrer en phase 0 — §2.2.3)

Candidats indicatifs (restauration, API ouverte, certifiés NF525/LNE) : **Zelty, L'Addition, Cashpad, Lightspeed Restaurant, Popina** — liste à confronter en phase 0 aux critères du §2.2.3 (périmètre du certificat couvrant l'API, capacités de l'API règlements/TVA, sandbox, coûts, éventuelle exécution sur matériel SUNMI). Le choix final appartient au client ; l'abonnement et le contrat caisse sont souscrits directement par le client auprès de l'éditeur.

### 2bis.4 Option de repli (non recommandée)

Si aucune caisse à API adéquate n'est retenue : développement d'un module fiscal ISCA en propre (immutabilité des tickets, chaînage cryptographique, clôtures Z, totaux perpétuels, journal des événements, archivage 6 ans, attestation individuelle du prestataire). Surcoût : +5 à 8 j, responsabilité d'éditeur et maintenance réglementaire à vie à la charge du prestataire. Écarté en v2.3 au profit du module E.

---

## 3. Acteurs et rôles

| Acteur | Description | Interface utilisée |
|---|---|---|
| **Client final** | Consulte le menu, commande et paie en ligne, ou commande au comptoir | Site public Next.js — `pizzeria.fr` |
| **Employé comptoir** | Saisit les commandes sur place, encaisse (TPE à part), imprime les tickets | POS Next.js dans l'app WebView sur SUNMI V2 — `app.pizzeria.fr/pos` |
| **Cuisine** | Visualise le flux de commandes et fait évoluer leur statut | Kitchen Display Next.js sur tablette — `app.pizzeria.fr/kitchen` |
| **Gérant (admin)** | Gère le menu, les prix, les horaires, consulte l'historique et les statistiques | Back-office Next.js — `app.pizzeria.fr/admin` |
| **Caisse certifiée** *(nouveau)* | Registre fiscal : reçoit toutes les ventes via API, produit clôtures Z et documents fiscaux | Caisse de l'éditeur retenu (Zelty ou équivalent) + son back-office éditeur |
| **Expert-comptable du client** *(consulté)* | Valide le schéma de flux fiscal et le choix de la caisse en phase 0 | — |

---

## 4. Description fonctionnelle

### 4.1 Module A — Site public Next.js (landing + commande en ligne)

Développé dans `app.pizzeria.fr/app/(public)/`, consomme l'**API Express** (`api.pizzeria.fr`). Rendu serveur Next.js pour le SEO.

**A1. Landing page** — identité, photos, horaires, adresse/carte, téléphone, réseaux sociaux ; bandeau « Ouvert / Fermé — réouverture à HH:MM » (horaires + **fermetures exceptionnelles**) ; mobile first, SEO local (schema.org LocalBusiness, Lighthouse > 90).

**A2. Catalogue / menu** — catégories et produits via l'API Express (photos, descriptions, prix, allergènes), **modifiers** RestaurantOS (taille, base, suppléments, retrait). Produit désactivé → masqué immédiatement. **Chaque produit porte son taux de TVA** (5,5 / 10 / 20 %) et son **identifiant de correspondance caisse** (mapping module E).

**A3. Tunnel de commande** — panier persistant ; click & collect avec **créneau horaire** (A7) ou **livraison par code postal** (A8) ; coordonnées client (nom, téléphone obligatoire, email, adresse si livraison) ; **commande invité** ; champ « instructions ».

**A4. Paiement en ligne** — Stripe Payment Element. Commande créée en `PENDING_PAYMENT` ; passage `CONFIRMED` uniquement après webhook `payment_intent.succeeded` signé. Email de confirmation. **La confirmation déclenche l'injection de la vente dans la caisse certifiée** (module E) avec mode de règlement « payé en ligne ».

**A5. Suivi client par token** — token unique à la confirmation ; page `/suivi/[token]` avec statut temps réel (Socket.io) : Reçue → En préparation → Prête → Récupérée/Livrée. QR sur le reçu.

**A6. Fermetures exceptionnelles** — bascule back-office avec plage de dates et message ; blocage tunnel + bandeau site.

**A7. Créneaux click & collect** — modèle `TimeSlot`, capacité max par créneau ; créneaux complets ou passés indisponibles.

**A8. Zones de livraison** — codes postaux, frais, minimum de commande ; refus explicite hors zone.

### 4.2 Module B — POS sur SUNMI V2 — **porté dans Next.js + APK à construire**

**B1. Application WebView (APK)** — `minSdkVersion 25` (Android 7.1), charge `https://app.pizzeria.fr/pos`, domaine verrouillé ; pont **`window.SunmiPrinter`** (SDK SUNMI InnerPrinter/PrinterX). L'APK maintient la WebView **résidente** (pas de rechargement volontaire en service) pour garantir le mode dégradé hors-ligne (voir B5).

**B2. Prise de commande sur place** — POS Next.js (`app.pizzeria.fr/app/(pos)/`) : grille produits 5,45", modifiers, panier, remises ; modes sur place / à emporter ; règlement espèces ou carte (TPE indépendant). Validation → `CONFIRMED` → **injection de la vente et de son règlement dans la caisse certifiée** (module E) → impression immédiate. Le numéro de ticket caisse est rattaché à la commande.

**B3. Réception commandes internet** — Socket.io : commande `CONFIRMED` → son (95 dB) + impression auto ticket cuisine. Réimpression 24 h (tickets cuisine ; les duplicatas de reçus fiscaux relèvent de la caisse).

**B4. Impression (SDK SUNMI, 58 mm)** — remplace WebUSB/`react-to-print` du socle :
- *Ticket cuisine* (non fiscal) : n°, origine (EN LIGNE / COMPTOIR), créneau, articles + options, instructions.
- *Reçu client* : émis à partir des **données renvoyées par la caisse certifiée** (numéro de ticket caisse, ventilation TVA par taux, totaux, moyen de paiement) + SIRET + QR `/suivi/:token`. En cas d'indisponibilité de la caisse, voir B5.
- Gabarits configurables ; table **`PrintJob`** (traçabilité, réimpression).

**B5. Robustesse et mode dégradé** — reconnexion Socket.io ; Wi-Fi → 4G. **Hors-ligne comptoir (V1)** : file IndexedDB (portée depuis le socle) + impression locale via pont SUNMI ; synchronisation API Express au retour réseau, **puis injection différée dans la caisse certifiée** (file d'injection, horodatage d'origine transmis si l'API caisse le permet — à valider en §2.2.3 ; à défaut, procédure documentée de rattrapage sur la caisse). Pendant une coupure, le reçu imprimé porte la mention « ticket provisoire — reçu définitif disponible en caisse ». **Prérequis** : l'APK garde la session WebView active sans rechargement pendant la coupure — la file IndexedDB ne survit pas à un rechargement de page. **Hors périmètre V1** : service worker / PWA sur le POS. Si la WebView est rechargée pendant une coupure, le POS reste indisponible jusqu'au retour réseau (comportement accepté et testé en recette n° 6). Erreurs imprimante journalisées dans `PrintJob`.

### 4.3 Module C — Kitchen Display — **porté dans Next.js**

`app.pizzeria.fr/app/(kds)/kitchen` en mode kiosque : colonnes temps réel (Socket.io), son à l'arrivée, changement de statut au toucher, propagation au suivi client et V2. Alertes retards par rapport au créneau.

### 4.4 Module D — Back-office gérant — **porté dans Next.js, étendu**

`app.pizzeria.fr/app/(admin)/` : menu, commandes, rapports, utilisateurs, réglages. Extensions : horaires, fermetures exceptionnelles, créneaux, zones livraison, gabarits tickets, export CSV, **écran de supervision des injections caisse** (module E : statut par commande, erreurs, file de rejeu, mapping catalogue). Les rapports de la plateforme sont **indicatifs** (pilotage opérationnel) ; les documents fiscaux (Z, TVA) font foi côté caisse. Modules hors périmètre masqués par feature flags.

### 4.5 Module E — Intégration caisse certifiée *(nouveau v2.3)*

Développé dans `server/` (service dédié + worker de file). Périmètre :

**E1. Mapping catalogue** — table de correspondance `MenuItem`/`ModifierOption` ↔ articles/options de la caisse, **taux de TVA par produit** ; écran d'administration du mapping (module D) ; contrôle de complétude (produit actif sans correspondance = alerte bloquante à la mise en vente).

**E2. Injection des ventes** — à chaque commande `CONFIRMED` : création de la commande dans la caisse via API (articles, options, remises, ventilation TVA) + **enregistrement du règlement** (espèces / carte TPE / payé en ligne). Récupération et stockage du **numéro de ticket caisse** sur l'`Order` (affiché sur le reçu B4 et dans le CRM).

**E3. File d'injection et rejeu** — injection **asynchrone et fiable** : file persistante (table `CashRegisterJob` : payload, tentatives, statut, erreur), retries avec backoff, idempotence (clé d'idempotence par commande pour éviter les doublons en caisse). L'indisponibilité momentanée de la caisse **ne bloque jamais** la prise de commande ni la cuisine ; les ventes sont injectées dès rétablissement. Alerte back-office si la file dépasse un seuil ou un délai.

**E4. Réconciliation** — rapport quotidien automatique : total des ventes `CONFIRMED` de la plateforme vs total injecté en caisse (par mode de règlement) ; écarts signalés au gérant avant clôture Z. Export CSV de contrôle pour l'expert-comptable.

**E5. Mode dégradé** — cf. B5 : injection différée avec horodatage d'origine si supporté, sinon procédure de rattrapage documentée (formation gérant).

**E6. Annulations / avoirs** — une commande annulée après injection déclenche l'opération inverse via API caisse si disponible ; à défaut, l'annulation est signalée au gérant pour saisie sur la caisse (procédure documentée). Aucune suppression silencieuse côté plateforme d'une vente déjà injectée.

*Les capacités exactes (règlements via API, horodatage, annulations) dépendent de la caisse retenue et sont validées en §2.2.3 ; le présent périmètre est ajusté en conséquence à l'issue de la phase 0.*

---

## 5. Flux de commande (résumé)

**Commande en ligne :** panier Next.js (`pizzeria.fr`) → API Express : `PENDING_PAYMENT` → Stripe → webhook signé → `CONFIRMED` → **injection caisse certifiée (règlement « payé en ligne », n° ticket caisse en retour)** → Socket.io → tablette + V2 (impression) → statuts cuisine → suivi `/suivi/:token`.

**Commande comptoir :** POS V2 (`app.pizzeria.fr/pos`) → règlement espèces ou carte TPE → API Express : `CONFIRMED` → **injection caisse certifiée (vente + règlement)** → impression (reçu avec n° ticket caisse) → tablette → même chaîne de statuts.

**Registre fiscal :** dans les deux flux, la caisse certifiée enregistre 100 % des ventes ; ses clôtures Z et sa ventilation TVA constituent la source comptable unique.

---

## 6. Architecture technique

### 6.1 Structure du monorepo

```
RestaurantOS/
├── server/                 # Express + Prisma + Socket.io + webhooks Stripe
│   ├── prisma/
│   └── src/cash-register/  # Module E : client API caisse + file d'injection (worker)
├── app.pizzeria.fr/        # Next.js — TOUTE l'UI (public, POS, KDS, admin)
│   ├── middleware.ts       # Routage par en-tête Host
│   └── app/
│       ├── (public)/       # servi sur pizzeria.fr
│       ├── (pos)/          # servi sur app.pizzeria.fr
│       ├── (kds)/          # servi sur app.pizzeria.fr
│       └── (admin)/        # servi sur app.pizzeria.fr
├── android/                # APK WebView SUNMI (à construire)
├── client/                 # LEGACY Vite — ne plus développer, exclu build/CI/Docker
└── docker-compose.yml      # prod : postgres + server + app.pizzeria.fr
```

**Routage multi-domaines (obligatoire)** — `pizzeria.fr` et `app.pizzeria.fr` pointent vers le **même conteneur** Next.js. Un **`middleware.ts`** route selon l'en-tête `Host` :

- `Host: pizzeria.fr` → réécriture vers les routes `(public)/` uniquement ; accès `(pos)|(kds)|(admin)` refusé (redirect ou 404).
- `Host: app.pizzeria.fr` → routes opérationnelles `(pos)`, `(kds)`, `(admin)` ; pas de tunnel commande public sur ce domaine.

### 6.2 Environnements

**Développement local (Laragon)** — pas de Docker, pas de Traefik :

| Service | URL locale | Port |
|---------|------------|------|
| PostgreSQL | Laragon | 5432 |
| API Express | `http://api.pizzeria.test` ou `localhost:3001` | 3001 |
| Next.js UI | `http://app.pizzeria.test` ou `localhost:3000` | 3000 |
| Site public | `http://pizzeria.test` (même Next.js, vhost Laragon) | 3000 |
| Caisse certifiée | **sandbox éditeur** (ou mock du client API caisse) | — |

Variables locales : `DATABASE_URL`, `NEXT_PUBLIC_API_URL=http://api.pizzeria.test`, `JWT_SECRET`, `STRIPE_*`, `CASH_REGISTER_*` (URL API, clés, identifiant établissement).

**Parité PostgreSQL** — même version **majeure** entre PostgreSQL Laragon (dev) et conteneur Docker (prod), ex. **PostgreSQL 16**. Les migrations Prisma sont testées sur les deux. **La recette finale (§9) s'exécute sur l'environnement Docker de préproduction/production**, avec la **caisse certifiée réelle du client** (ou sa sandbox de production).

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
```

Traefik : réseau Docker externe `traefik` ; labels sur les conteneurs `app` et `server` ; **pas de service Caddy** dans le compose.

### 6.3 Choix techniques

| Composant | Choix | Statut |
|---|---|---|
| UI (public + POS + KDS + admin) | **Next.js App Router** (`app.pizzeria.fr/`) | À construire / porter depuis `client/` |
| Frontend legacy | ~~Vite + react-router~~ (`client/`) | **Abandonné** — exclu build Docker et CI |
| i18n UI | **next-intl** (`app.pizzeria.fr/`) | À mettre en place |
| Routage multi-domaines | **middleware.ts** (routage par `Host`) | À construire |
| API métier | **Express + Prisma + Socket.io + Stripe** (`server/`) | Socle adapté |
| **Registre fiscal** | **Caisse certifiée NF525/LNE** (Zelty ou équivalent), intégrée via API (module E) | **Choix client en phase 0** |
| Base de données | **PostgreSQL** (Laragon local, Docker prod) | Migration depuis SQLite |
| Auth staff | **JWT du socle** (bcrypt, rate limiting, rôles admin/employé) | Conservé |
| Temps réel | **Socket.io** | Conservé |
| Paiement en ligne | **Stripe** (Payment Element + webhooks signés sur Express) | Socle, branché au tunnel Next.js |
| App V2 | **APK WebView** (minSdk 25) + `window.SunmiPrinter` | À construire |
| Reverse proxy prod | **Traefik** (VPS Hostinger, labels Docker) | Existant côté infra |
| Sauvegardes | `pg_dump` quotidien + copie chiffrée hors VPS | À mettre en place |

### 6.4 Feature flags

Variable `ENABLED_MODULES`. **Actifs V1 :** menu, POS, kitchen, commandes, rapports, utilisateurs, réglages, **cash-register (module E)**. **Désactivés V1 :** wifi, tables, réservations, fidélité, shifts, dépenses, licences. Désactivation = nav masquée + routes API 404/403.

### 6.5 Modèle de données

Socle RestaurantOS conservé : `Business`, `User`, `MenuCategory`, `MenuItem`, `MenuModifier`, `ModifierOption`, `Order`, `OrderItem`, plus tables dormantes. **Modifications :** centimes (entiers) ; `PENDING_PAYMENT` ; **taux de TVA par `MenuItem`** ; **`cashRegisterRef` (mapping) sur `MenuItem`/`ModifierOption`** ; **`cashRegisterTicketId` sur `Order`**. **Ajouts :** `TimeSlot`, `DeliveryZone`, `PrintJob`, **`CashRegisterJob`** (file d'injection : payload, idempotence, tentatives, statut, erreur), `trackingToken` sur `Order`, fermetures exceptionnelles dans les réglages.

Statuts : `PENDING_PAYMENT → CONFIRMED → PREPARING → READY → COMPLETED` (+ `CANCELLED`).

---

## 7. Exigences non fonctionnelles

- **Conformité fiscale** *(nouveau v2.3)* : 100 % des ventes encaissées (comptoir + web) enregistrées dans la caisse certifiée ; réconciliation quotidienne (E4) ; reçu client fiscal issu des données caisse ; le certificat NF525/LNE de la caisse (périmètre API inclus) est conservé par le client ; schéma de flux validé par l'expert-comptable du client en phase 0. La plateforme n'émet aucun document se substituant aux documents fiscaux de la caisse.
- **Sécurité** : HTTPS via Traefik ; aucune donnée bancaire sur serveur/site/V2 ; **clés API caisse stockées côté serveur uniquement** (jamais exposées au front/POS) ; routes modules désactivés neutralisées ; APK verrouillée sur le domaine ; audit §2.2 appliqué ; `npm audit` sans critique à la livraison.
- **Compatibilité SUNMI V2** : Client Components Next.js ; **WebView Chrome ≥ 64 obligatoire** (prérequis contractuel §2.2.2) ; recette sur appareil réel ; V2 usage interne uniquement.
- **Performance** : commande visible tablette + V2 < 3 s après confirmation ; impression < 5 s ; injection caisse asynchrone (n'ajoute aucune latence perçue) ; Lighthouse > 90 (site public mobile).
- **Disponibilité** : `restart: always` ; monitoring (Uptime Kuma) ; **l'indisponibilité de la caisse ou de son API ne bloque ni la prise de commande ni la cuisine** (file E3), seule l'injection est différée.
- **Mode dégradé** : 4G V2 + file IndexedDB tant que la WebView APK reste chargée (§4.2 B5) ; injection caisse différée avec rattrapage tracé ; restauration < 1 h depuis sauvegarde.
- **RGPD** : mentions légales, politique de confidentialité, consentement cookies, minimisation des données, purge/anonymisation commandes > 3 ans (hors obligations de conservation comptable portées par la caisse), **registre des traitements** (incluant le transfert des données de vente vers l'éditeur de la caisse — à mentionner dans la politique de confidentialité).
- **Licence** : notice MIT RestaurantOS conservée ; fichier `NOTICE`.

---

## 8. Livrables

1. Monorepo Git : `server/` adapté (dont module E `cash-register/`), `app.pizzeria.fr/` Next.js, APK SUNMI (`android/`).
2. **Rapport d'audit** du socle (§2.2.1) et **rapport de validation API caisse** (§2.2.3 : capacités, périmètre du certificat, limites, choix retenu).
3. `docker-compose.yml` (postgres + server + app.pizzeria.fr, labels Traefik), scripts sauvegarde/restauration, doc installation VPS.
4. Interface intégralement en français (**next-intl**) ; montants en EUR (centimes) ; TVA multi-taux par produit.
5. Documentation d'exploitation gérant, **incluant les procédures caisse** : réconciliation quotidienne, rattrapage après coupure, annulations/avoirs, conservation du certificat de la caisse.
6. Jeu de tests de recette (§9).

*À la charge du client (hors livrables prestataire) : souscription et paramétrage de la caisse certifiée auprès de son éditeur ; conservation du certificat NF525/LNE ; validation du dispositif par son expert-comptable.*

---

## 9. Recette (critères d'acceptation clés)

1. Commande payée en ligne : `PENDING_PAYMENT → CONFIRMED` via webhook Stripe ; impression V2 + tablette < 3 s avec son ; **vente présente dans la caisse certifiée avec règlement « payé en ligne » et n° de ticket caisse rattaché**.
2. Paiement abandonné : reste `PENDING_PAYMENT`, invisible cuisine/V2, non imprimée, **non injectée en caisse**.
3. Commande comptoir V2 (espèces puis carte) : tickets cuisine + reçu client portant le **n° de ticket caisse** et la **ventilation TVA par taux** + tablette ; vente et règlement présents en caisse.
4. Suivi `/suivi/:token` temps réel jusqu'à « Prête ».
5. Créneau plein indisponible ; code postal hors zone refusé.
6. Coupure Wi-Fi sur V2 (APK résidente, **sans rechargement** de page) : prise de commande locale + impression OK (mention « ticket provisoire ») ; synchronisation au retour réseau **et injection différée en caisse tracée** (`CashRegisterJob`). Scénario « rechargement pendant coupure → POS indisponible jusqu'au réseau » documenté comme comportement attendu V1.
7. Indisponibilité de l'API caisse (simulation) : prise de commande et cuisine non bloquées ; file d'injection en attente + alerte back-office ; rejeu automatique au rétablissement **sans doublon** (idempotence).
8. **Réconciliation** : le total quotidien plateforme = total injecté caisse par mode de règlement ; rapport E4 conforme ; ticket **Z de la caisse** cohérent avec le CA de la journée de test (web + comptoir).
9. Annulation d'une commande déjà injectée : opération inverse en caisse (ou procédure documentée exécutée) ; aucune divergence résiduelle.
10. Produit multi-taux : pizza à emporter (10 %), boisson alcoolisée (20 %), produit à 5,5 % — ventilation TVA exacte sur le reçu et en caisse.
11. Fermeture exceptionnelle : tunnel bloqué + bandeau site.
12. Modules désactivés : API 404/403, nav absente.
13. Interface 100 % française ; montants EUR au centime.
14. Restauration base depuis sauvegarde veille réussie.
15. Impression SUNMI V2 réelle conforme ; réimpression ticket cuisine ; erreur papier remontée.
16. WebView du V2 ≥ 64 confirmée en recette (ou matériel de remplacement documenté).
17. **Certificat NF525/LNE de la caisse** en cours de validité remis au client, périmètre couvrant l'ingestion API (vérifié en phase 0, confirmé à la livraison).

---

## 10. Planning

| Phase | Contenu | Durée |
|---|---|---|
| 0 | **Go/no-go** : audit socle (§2.2.1) + mesure WebView V2 ≥ 64 (§2.2.2) + **choix caisse certifiée et validation API** (§2.2.3, avec le client et son expert-comptable) | 2–3 j |
| 1 | Adaptations API : PostgreSQL 16, centimes, mono-tenant, `PENDING_PAYMENT`, TVA multi-taux, feature flags | 3 j |
| 2 | Scaffold `app.pizzeria.fr/` + middleware Host + port POS/KDS/admin depuis `client/` | 4–6 j |
| 3 | Français + EUR (**next-intl**) | 1 j |
| 4 | Pont SUNMI + APK résidente + `PrintJob` + gabarits | 4–6 j |
| 4bis | **Module E — intégration caisse certifiée** : client API, mapping catalogue, file d'injection idempotente, réconciliation, écran de supervision | 3–5 j |
| 5 | Site public `(public)/` : landing SEO, menu, tunnel, Stripe | 5–8 j |
| 6 | Créneaux + zones + token suivi + fermetures | 4–5 j |
| 7 | Déploiement VPS (Compose, Traefik, sauvegardes), **recette sur Docker avec caisse réelle/sandbox**, formation (dont procédures caisse) | 2–3 j |

**Total indicatif : 28 à 40 jours ouvrés, soit environ 5,5 à 8 semaines** (somme des phases, travail séquentiel).

*Note : un chevauchement partiel est possible (ex. phases 5 et 4/4bis en parallèle si deux intervenants) — peut ramener vers **4,5 à 6 semaines** en configuration optimale, sans garantie contractuelle. La phase 4bis dépend de la disponibilité de la sandbox de l'éditeur de caisse (à sécuriser dès la phase 0).*

Comparatif : v1.0 from scratch = 9–13 semaines ; v2.x socle RestaurantOS = réduction d'environ **40 à 50 %** du délai v1.0. L'option de repli « module ISCA en propre » (§2bis.4) ajouterait 5–8 j au présent planning et transférerait la responsabilité réglementaire au prestataire.

No-go audit (§2.2.1) → retour planning v1.0. No-go WebView (§2.2.2) → POS V2 bloqué, reste du projet poursuivable. No-go caisse (§2.2.3) → arbitrage client : autre éditeur de caisse ou avenant §2bis.4.

---

## 11. Coûts récurrents pour le client

- **Caisse certifiée** (Zelty ou équivalent) : abonnement de l'ordre de **30 à 90 €/mois** selon l'éditeur et l'offre, + frais éventuels d'accès API / programme partenaire (à chiffrer en phase 0). *Poste imposé par l'obligation légale art. 286 CGI ; inclut les mises à jour réglementaires et le maintien du certificat par l'éditeur.*
- VPS Hostinger : ~5–15 €/mois · Domaine : ~10 €/an · Stripe : commission par transaction · Email transactionnel (confirmation de commande) : offre gratuite ou < 10 €/mois selon volume · Papier 58 mm.
- **Aucun abonnement logiciel pour la plateforme développée** (site, POS, KDS, CRM).

---

## 12. Évolutions futures (V2+)

Réactivation modules dormants par feature flag ; TPE protocolaire ; SMS « commande prête » ; second point d'impression ; 2e point de vente (multi-tenant, multi-établissement côté caisse) ; remplacement SUNMI V2/V2s/V3 ; exploitation avancée des données caisse (marges, food cost) si l'API de l'éditeur le permet.
