<!-- PROJECT LOGO -->
<br />
<div align="center">
  <h1>🍕 La Z Pizza</h1>
  <p align="center">
    <strong>Plateforme de commande en ligne & d'encaissement pour pizzeria</strong>
    <br />
    <em>Commande web + click&nbsp;&amp;&nbsp;collect/livraison, caisse tablette, écran cuisine, app livreur, conformité fiscale française</em>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16">
    <img src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white" alt="React 19">
    <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
    <img src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white" alt="Prisma">
    <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
    <img src="https://img.shields.io/badge/Socket.io-4.8-010101?logo=socketdotio&logoColor=white" alt="Socket.io">
    <img src="https://img.shields.io/badge/license-MIT-brightgreen" alt="License MIT">
  </p>
</div>

<br/>

> Ce dépôt part du socle open source **RestaurantOS** (MIT) mais a été très largement modifié et spécialisé pour un cas d'usage unique : **une pizzeria française mono-établissement**, avec commande en ligne, caisse/cuisine sur tablette, livraison prépayée, et conformité fiscale à la norme **ISCA** (art. 286 I‑3° bis du CGI).
>
> 📖 Documentation technique complète (architecture, modules, base de données, variables d'env.) : **[README-PROJET.md](README-PROJET.md)**
> 📋 Spécifications contractuelles : **[cahier-des-charges-pizzeria-v2.4.md](cahier-des-charges-pizzeria-v2.4.md)**

---

## Ce que fait la plateforme

| Module                           | Description                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 🌐 **Site client**               | Menu, commande en ligne (click & collect ou livraison), paiement **SumUp**, suivi temps réel de commande  |
| 💳 **Caisse (POS)**              | App tablette comptoir — prise de commande sur place, encaissement, ticket fiscal, mode dégradé hors-ligne |
| 🍳 **Écran cuisine (KDS)**       | App tablette cuisine — tickets de préparation temps réel, notifications sonores, impression auto          |
| 🛵 **App livreur**               | App mobile — tournées de livraison (commandes déjà payées en ligne, le livreur n'encaisse jamais)         |
| 🖨️ **Impression thermique**      | Reçus comptoir + bons cuisine sur imprimantes **Epson TM** en réseau local (ePOS-Print / ESC-POS)         |
| 🧾 **Conformité fiscale (ISCA)** | Chaînage cryptographique des tickets, clôtures Z, journal d'événements, archivage — art. 286 CGI          |
| 🎁 **Fidélité**                  | Points par pizza, palier de gratuité, affichage du solde au checkout                                      |
| 📊 **Back-office admin**         | Commandes, menu, rapports, stock/recettes, facturation, planning, employés, dépenses, réglages            |

## Architecture (résumé)

```
Client (navigateur) ──► pizzeria.fr / app.pizzeria.fr (Next.js, App Router)
APK caisse / KDS / livreur (WebView Kotlin) ──►        │
                                                        ▼
                                            server/ (Express + Socket.io)
                                                        │
                                                        ▼
                                       PostgreSQL 16 (Prisma) + module fiscal ISCA
                                                        │
                                       SumUp (paiement) · MinIO (sauvegardes) · Sentry
```

- **Frontend** : `app.pizzeria.fr/` — Next.js 16, routage par hôte (site public vs interface ops caisse/cuisine/admin).
- **Backend** : `server/` — API Express, source de vérité métier, Prisma → PostgreSQL, Socket.io pour le temps réel.
- **Android** : `android/` — enveloppes WebView Kotlin (POS, KDS, livreur) chargeant les modules Next.js.
- **`client/`** : ancienne SPA Vite du socle d'origine — **dépréciée**, exclue du build et de la CI.

Détails complets (structure du dépôt, 38 modèles Prisma, API REST, variables d'environnement) : **[README-PROJET.md](README-PROJET.md)**.

## Démarrage rapide (dev local)

Prérequis : Node.js ≥ 20, PostgreSQL 16 (ou Docker), npm ≥ 9.

```bash
npm run setup        # install racine + server + app.pizzeria.fr, prisma generate/push, seed
npm run dev          # stack dev : web Next.js (:3000) + API (:3001)
npm run dev:stop     # libère les ports
```

- Web : http://localhost:3000
- API : http://localhost:3001/api/health
- Swagger : http://localhost:3001/api/docs

```bash
npm run db:migrate   # prisma migrate dev
npm run db:seed      # données de démo
npm test             # backend — Jest + Supertest
npm run lint         # ESLint (server + app.pizzeria.fr)
npm run typecheck    # tsc --noEmit
```

Stack Docker locale : `docker-compose up -d` (Postgres + API + web). Déploiement production VPS (Traefik) : voir [docs/VPS-DEPLOIEMENT.md](docs/VPS-DEPLOIEMENT.md) et [deploy/README.md](deploy/README.md).

## Sécurité

JWT (access/refresh + rotation), rôles (admin/caisse/cuisine/livreur), PIN employé, Helmet CSP, rate limiting par palier, sanitization XSS, protection HPP, CORS whitelist. Aucune donnée carte bancaire stockée côté plateforme ou APK — paiement via SumUp. Détails : [SECURITY.md](SECURITY.md).

## Documents de référence

| Document                                                                   | Contenu                                                         |
| -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [README-PROJET.md](README-PROJET.md)                                       | Documentation technique complète (architecture, BDD, API, env.) |
| [cahier-des-charges-pizzeria-v2.4.md](cahier-des-charges-pizzeria-v2.4.md) | Spécifications contractuelles                                   |
| [docs/conformite-article-286-cgi.md](docs/conformite-article-286-cgi.md)   | Conformité fiscale (art. 286 CGI, critères ISCA)                |
| [docs/VPS-DEPLOIEMENT.md](docs/VPS-DEPLOIEMENT.md)                         | Déploiement production                                          |
| [android/README.md](android/README.md)                                     | Build & installation des APK                                    |
| [CHANGELOG.md](CHANGELOG.md)                                               | Historique des versions                                         |

## Licence

Socle distribué sous licence **MIT** ([LICENSE](LICENSE)). Le contenu métier (spécifications, contenu du menu, identité de l'établissement) n'est pas destiné à être réutilisé tel quel.
