# Brief de reprise — RestaurantOS (2026-08-25)

> Généré par Claude à la demande de Samir pour reprendre la conversation dans le workspace RestaurantOS après fermeture du workspace Jarvis. Résume tout ce qui a été fait/décidé en parallèle avec Cursor (Composer) sur ce projet.

## 1. Contexte

Chantier en cours sur RestaurantOS : refactor contrôlé inspiré d'un benchmark avec **URY** (app restaurant open-source sous Frappe/ERPNext, AGPLv3/GPLv3). **Décision actée : pas de migration vers URY/ERPNext** — URY sert uniquement de référence d'architecture pour comparer et piquer des idées, RestaurantOS reste Express + Prisma + React/Next.js.

Deux personnes travaillent en parallèle sur le même repo :

- **Cursor (Composer)** : chantier principal — RBAC, découpe `orders.ts`, module driver.
- **Claude (moi)** : audits, revues de code, et un chantier dédié (Phase E — voir §4) mené dans un **git worktree isolé** pour ne pas gêner Cursor.

Doc de référence partagé (mis à jour au fil de l'eau par les deux) : **`docs/FAISABILITE-PLAN-URY.md`**.

## 2. Ce qui est fait et commité (historique `git log`)

```
5193cbb feat: pos cash session and bill merge         ← Phase E (moi), + gate ajouté par Cursor
7f77adf feat: stock rbac and recipe bom polish         ← P2
5fe44a6 feat: rbac licenses/employees, driver FE API, backup scripts LF
464e7fa feat: order split, rbac hardening, driver api, loyalty delete   ← inclut ma suppression RGPD loyalty
da56a42 feat: p0 foundations and sumup-only payments   ← P0
```

Détail par phase (voir `docs/FAISABILITE-PLAN-URY.md` pour le mini-spec complet de chacune) :

| Phase | Contenu                                                                                                                                                                      | Statut                                                                                                        |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| P0    | Numérotation commande atomique (`allocateOrderNumber` + `@@unique`), enums + state machine statut, `PaymentProvider` SumUp only (plus de Stripe actif), RBAC reports/loyalty | ✅                                                                                                            |
| P1    | Découpe `orders.ts` (1356→~766 lignes) en `lib/order-*.ts`, URLs API stables                                                                                                 | ✅                                                                                                            |
| A     | RBAC `orders.ts` complet (`ORDERS_READ/WRITE/PAYMENT/CANCEL/ASSIGN_DRIVER/CUSTOMER_PII`)                                                                                     | ✅                                                                                                            |
| B     | Module DRIVER API serveur (`lib/driver-actions.ts`, `/api/driver/*`, scoping strict)                                                                                         | ✅                                                                                                            |
| C     | RBAC `settings.ts` + `devices.ts`                                                                                                                                            | ✅                                                                                                            |
| D     | RBAC `licenses.ts` + `employees.ts`                                                                                                                                          | ✅                                                                                                            |
| FE    | `DriverCourierView` migré vers `/api/driver/*` + PIN                                                                                                                         | ✅                                                                                                            |
| P2    | Stock RBAC + recettes (BOM) polish                                                                                                                                           | ✅ (commit `7f77adf`) — **le doc partagé dit encore "Plus tard" pour P2, juste pas remis à jour, à corriger** |
| **E** | **POS avancé : session de caisse (ouverture/fermeture + écart) + fusion de notes**                                                                                           | ✅ — voir §4, mené par moi puis complété par Cursor                                                           |
| F     | Transfert de commande entre tables/serveurs (stretch, dépend de E)                                                                                                           | Plus tard                                                                                                     |
| P3    | Option B multi-entry frontend                                                                                                                                                | Plus tard (gros chantier, au GO produit)                                                                      |
| P4-P5 | Legacy `client/` (gelé), Android                                                                                                                                             | Plus tard                                                                                                     |

**Ce qui est définitivement fermé côté audit original (1.1 à 1.9, 1.4, 1.7)** : numérotation, enums, paiement SumUp, permissions sur tous les modules sensibles (orders/settings/devices/licenses/employees/reports/loyalty), module driver scopé, RGPD loyalty.

**Ce qui reste vraiment ouvert** : Option B (restructuration frontend multi-entry — gros morceau), legacy `client/`/Android, transfert de commande (F).

## 3. Mon travail parallèle sur `loyalty.ts` (fondu dans `464e7fa`)

Trou RGPD trouvé lors de l'audit initial : la page admin fidélité (`AdminLoyaltyView.tsx`) existait (liste/recherche/ajout de points) mais **aucune suppression** n'était possible — droit à l'effacement RGPD impossible à honorer.

Ajouté : `DELETE /api/loyalty/customers/:id` (permission `LOYALTY_ADJUST`, ADMIN/MANAGER only, purge les `LoyaltyTransaction` avant suppression), bouton d'effacement côté UI avec confirmation. Testé (5 tests), typecheck propre. C'est passé dans le commit `464e7fa`.

## 4. Phase E — Session de caisse + fusion de notes (mon chantier, maintenant committé)

**Origine** : déploiement de test de URY sur le VPS Hostinger (voir §5) pour comparer CRM/KDS/POS. Verdict : RestaurantOS gagnant sur CRM (fidélité — URY n'a rien) et KDS (URY = juste un toast de notif, pas d'écran dédié). URY avait 2 vraies avances côté POS : session de caisse formelle et fusion de notes.

**Livré** (fait dans un worktree séparé `../RestaurantOS-pos-session`, branche `feat/pos-session-merge`, puis committé par Samir avec l'aide de Cursor dans `5193cbb`) :

- Backend : modèle Prisma `PosSession` (pas de FK sur `Order`, fiscalement sensible — rapprochement par fenêtre temporelle + `cashierId`), `lib/pos-session.ts` (ouverture/fermeture, calcul écart vs encaissements CASH), `lib/order-merge.ts` (symétrique de `order-split.ts`, mêmes garde-fous, commandes sources passées en `CANCELLED` avec note de traçabilité au lieu d'être supprimées), permission `POS_SESSION`, routes `/api/pos/session/*` et `POST /api/orders/merge`.
- Frontend : `PosOpeningDialog`, `PosClosingDialog`, `BillMergeDialog`, `PosSessionTab`, nouvelle tuile "Session caisse" dans `PosHomeHub.tsx`.
- **Ajouté par Cursor après ma passe** : `PosCashSessionGate.tsx` — bloque l'accès à la prise de commande tant qu'aucune session n'est ouverte. J'avais volontairement laissé ce point de côté (décision de UX que je ne voulais pas prendre seul) ; Cursor a tranché et l'a implémenté.
- Tests : `pos-session.test.ts` + `order-merge.test.ts`, 10/10 verts. Typecheck propre serveur + `app.pizzeria.fr`.

**Point non résolu à la fin de mon tour** : je n'avais pas intégré ouverture/fermeture/fusion directement dans `PosDisplay.tsx` (1400 lignes, complexe — même le split existant n'y était câblé nulle part avant), j'avais choisi un onglet séparé par prudence. À vérifier si Cursor a changé ça en ajoutant le gate.

## 5. Expérimentation URY sur VPS (Hostinger, partagé avec la prod)

- **Installé** : `ury-erp/ury` (Frappe/ERPNext v15, AGPLv3) via Docker isolé, exposé sur **`https://ury.gsms-security.com`** (Traefik + HTTPS, conteneurs `ury-*` indépendants de `pizzeria-postgres` etc.).
- Compte : `Administrator` / mot de passe généré en session (donné dans le chat précédent, pas re-collé ici pour ne pas laisser un secret dans un fichier de repo — si perdu, reset via `docker compose -p ury exec backend bench --site ury.gsms-security.com set-admin-password <nouveau>`).
- **Bugs rencontrés et contournés pendant l'install** : `FiscalYearError` (exercice fiscal auto-créé ne couvrait pas la date du jour — corrigé en ajoutant l'exercice manquant), puis `Income Account None` avec le plan comptable français (bug du script de démo `ury/setup/demo.py`, incompatible avec le plan "France - Plan Comptable General" — contourné en utilisant le plan "Standard", exécuté directement en CLI plutôt que via le wizard navigateur pour fiabiliser).
- **Comparaison actée** :
  - CRM/fidélité : RestaurantOS largement devant (URY = zéro fonctionnalité fidélité restaurant).
  - KDS : RestaurantOS devant (vrai écran cuisine temps réel ; URY n'a qu'un toast de notif, pas d'écran dédié, en beta v3).
  - POS : mixte — URY avait la session de caisse et la fusion de notes (→ rattrapé, Phase E), RestaurantOS garde l'avance sur le mode hors-ligne (offline queue), l'intégration matérielle (imprimantes, APK Android), et la rigueur base de données (numérotation atomique, state machine).
- **Licence** : AGPLv3 (URY) / GPLv3 (ERPNext, HRMS) — **interdit de faire du SaaS propriétaire fermé** avec du code URY/ERPNext modifié sans republier les modifications. Confirme que la stratégie "pas de migration URY" était aussi motivée par la licence, pas seulement la technique.

## 6. État Git actuel — ⚠️ à vérifier en premier à la reprise

**Ne pas se fier à ce snapshot** (pris le 2026-08-25 vers 01h40) — Cursor travaille probablement encore. Refaire `git status` / `git log` dès l'ouverture du workspace.

- Repo principal (`C:\laragon\www\RestaurantOS`) : actuellement sur la branche **`feat/admin-loyalty-rgpd-delete`** (pas `main`), avec **34 fichiers modifiés non commités** au moment de ce brief — touchent `marketplace-integrations.ts`, `marketplace-order.ts`, `delivery-quote.ts`, plusieurs `lib/order-*.ts`, `admin-live-events.ts`, `enqueue-order-prints.ts`. Vraisemblablement Cursor en plein chantier sur un sujet marketplace/livraison non documenté dans le brief au moment de l'écriture.
- Un **git worktree séparé** existe : `C:\laragon\www\RestaurantOS-pos-session` (branche `feat/pos-session-merge`) — a servi à mon travail Phase E, peut être supprimé (`git worktree remove`) une fois confirmé que tout est bien fusionné/committé côté branche principale.
- Branches locales : `main`, `feat/admin-loyalty-rgpd-delete`, `feat/pos-session-merge` — les deux dernières sont aussi poussées sur un remote nommé **`personal`**.
- **Point d'attention** : `main` local n'a peut-être pas reçu ces commits (`da56a42` → `5193cbb` semblent avoir été faits directement sur `feat/admin-loyalty-rgpd-delete`, pas rebasés/mergés sur `main`) — à clarifier avec Samir/Cursor avant de pousser quoi que ce soit sur `origin` ou de considérer le travail "fini".
- Postgres local (Laragon) a été démarré manuellement pendant la session (`pg_ctl start` — il ne tournait pas par défaut) pour appliquer la migration `pos_session`. Vérifier qu'il tourne toujours si des tests locaux échouent avec `P1001`.

## 7. Décisions en attente / points ouverts

**Répartition actée** — `docs/BRIEF-REPRISE-2026-08-25.md` §6.  
**Samir** = test VPS uniquement après commit + push + redeploy (pas dans le lot agents).

1. **Cursor** : doc P2 ✅ ; clean worktree pos-session ; STRIPE env ; intégration F ; push + `pack-for-vps`.
2. **Claude** : audit `PosCashSessionGate` ; Phase F en worktree (`feat/order-transfer`).
3. **GO Samir explicite** seulement pour : merge → `main`/`origin`, et P3.
4. **Personne** : P3 sans GO.

## 8. Pour reprendre vite

- Relire ce fichier + `docs/FAISABILITE-PLAN-URY.md` (source de vérité technique, plus détaillée que ce brief).
- `git log --oneline -10` et `git status` pour voir ce que Cursor a fait depuis.
- Le VPS Hostinger tourne toujours (`ssh hostinger`) — `pizzeria-*` (prod RestaurantOS) et `ury-*` (démo comparative) cohabitent, isolés.
