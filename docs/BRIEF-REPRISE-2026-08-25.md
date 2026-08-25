# Brief reprise — RestaurantOS (session Cursor / Jarvis)

> **Créé :** 2026-08-25  
> **But :** reprendre le chantier depuis le workspace `RestaurantOS` sans dépendre de l’historique Jarvis.  
> **Repo :** `c:\laragon\www\RestaurantOS`  
> **Remote utile :** `personal` → `https://github.com/samiriggui-code/RestaurantOS.git`  
> **Branche courante :** `feat/admin-loyalty-rgpd-delete` @ **`5193cbb`**

---

## 1. Cadre produit (figé)

| Décision     | Contenu                                                                                |
| ------------ | -------------------------------------------------------------------------------------- |
| Architecture | Refactor contrôlé **KEEP / SECURE / CENTRALIZE** — **pas** migration URY/ERPNext       |
| URY          | Référence UI/benchmark seulement (`ury.gsms-security.com`)                             |
| Front actif  | `app.pizzeria.fr/` (Next) — **`client/` Vite = GELÉ**                                  |
| Paiement     | **SumUp only** — interdiction de réintroduire Stripe actif                             |
| VPS labo     | `root@187.77.166.124` → `/opt/pizzeria` — deploy via `deploy/scripts/pack-for-vps.ps1` |
| Doc skill    | `docs/FAISABILITE-PLAN-URY.md`                                                         |

---

## 2. Où on en est (skill URY)

| Phase          | Contenu                                             | Statut       | Commit / note         |
| -------------- | --------------------------------------------------- | ------------ | --------------------- |
| **P0**         | OrderNumber, enums/FSM, SumUp, RBAC reports/loyalty | ✅           | `da56a42`             |
| **P1**         | Découpe `orders.ts` → `lib/order-*`                 | ✅           | `464e7fa`             |
| **A**          | RBAC orders                                         | ✅           | `464e7fa`             |
| **B**          | DRIVER API `/api/driver/*`                          | ✅           | `464e7fa`             |
| **C**          | RBAC settings/devices                               | ✅           | `464e7fa`             |
| **D**          | RBAC licenses/employees                             | ✅           | `5fe44a6`             |
| **FE driver**  | `DriverCourierView` → `/api/driver` + PIN headers   | ✅           | `5fe44a6`             |
| **Ops backup** | Scripts MinIO UTF-8 sans BOM + LF ; cron 04:00      | ✅           | VPS OK                |
| **P2**         | Stock RBAC + validation BOM + UX couverture         | ✅           | `7f77adf`             |
| **E**          | Session caisse + fusion notes + gate commande       | ✅           | `5193cbb` **sur VPS** |
| **F**          | Transfert commande table/serveur                    | ❌ Plus tard |
| **P3**         | Option B multi-entry front                          | ❌ Plus tard |
| **P4–P5**      | Legacy client / Android                             | ❌ Plus tard |

**Tip live labo :** merge fast-forward dans `feat/admin-loyalty-rgpd-delete` + `pack-for-vps.ps1` — migration `20260825010000_pos_session` **appliquée**.

---

## 3. Preuves runtime (à retenir)

- API health : `https://pizza-api.gsms-security.com/api/health`
- App : `https://pizza-app.gsms-security.com`
- Backup MinIO : scripts OK (plus d’erreur BOM/`pipefail`)
- Tests Phase E : `pos-session` + `order-merge` + `permissions` verts avant ship
- PIN labo seed : caisse `1234` · cuisine `5678` · livreur `3456`

---

## 4. Phase E — ce qui est en prod labo

**Backend**

- `PosSession` (Prisma) + migration
- `server/src/lib/pos-session.ts` — open / close (écart cash attendu)
- `server/src/lib/order-merge.ts` — fusion notes
- Routes : `GET/POST /api/pos/session/*`, `POST /api/orders/merge`
- Permission : `PERMISSION.POS_SESSION` (ADMIN / MANAGER / CASHIER)

**Frontend**

- `PosOpeningDialog` / `PosClosingDialog` / `BillMergeDialog`
- `PosSessionTab` + tile hub « Session caisse »
- **`PosCashSessionGate`** — bloque le module **Commande** tant qu’aucune session OPEN

**Worktree Claude (historique)**

- `C:\laragon\www\RestaurantOS-pos-session` branche `feat/pos-session-merge`
- Peut être retiré après merge : `git worktree remove ...` si plus besoin

---

## 5. Règles parallélisation (session précédente)

- Cursor = backend / deploy / P2 / reprise E
- Claude avait pris E en **worktree séparé** pour éviter `git add -A` croisé
- Fichier souvent en conflit doc : `docs/FAISABILITE-PLAN-URY.md` — un seul agent à la fois dessus

---

## 6. Répartition Cursor ↔ Claude (2026-08-25)

**Rôle Samir :** uniquement **tester en prod labo** après `commit` → `push` → `pack-for-vps` / redeploy. Pas de tâches de code, doc ou recette locale dans le lot agents.

Règle agents : **un seul** sur `docs/FAISABILITE-PLAN-URY.md` ; Claude = worktree isolé pour features ; Cursor = branche principale + deploy.

| #   | Tâche                                            | Owner                             | Détail                                                                                                             |
| --- | ------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | Doc P2 ✅ dans `FAISABILITE-PLAN-URY.md`         | **Cursor**                        | Doc seul                                                                                                           |
| 2   | Audit UX `PosCashSessionGate` + note GO/NO-GO    | **Claude**                        | Lecture / revue ; patch gate seulement si défaut clair                                                             |
| 3   | Phase F — transfert table/serveur                | **Claude** worktree               | Mini-spec F : `lib/order-transfer.ts`, `PATCH /api/orders/:id/transfer`, dialog POS. Branche `feat/order-transfer` |
| 4   | Clean worktree `RestaurantOS-pos-session`        | **Cursor**                        | Après confirm E = `5193cbb`                                                                                        |
| 5   | Retrait `STRIPE_*` `.env` local + VPS            | **Cursor**                        | Ops ; pas de 2ᵉ PSP                                                                                                |
| 6   | Intégration F → branche feat + tests + typecheck | **Cursor**                        | Merge worktree Claude quand F prêt                                                                                 |
| 7   | Commit / push `personal` + redeploy VPS          | **Cursor**                        | Puis **Samir teste** sur labo                                                                                      |
| 8   | Merge → `main` / `origin`                        | **Cursor** sur GO explicite Samir | Pas de push origin sans GO                                                                                         |
| 9   | P3 Option B                                      | **Personne**                      | Bloqué sans GO produit                                                                                             |

**Parallèle :** Cursor #1+#4+#5 ‖ Claude #2 puis #3.  
**Séquentiel :** Cursor #6 → #7 → Samir teste VPS. Merge `main` (#8) après OK test.

**Interdit croisé :** Claude ne touche pas le repo principal (`git add -A`) ; Cursor ne code pas F sur la branche courante tant que le worktree F n’est pas prêt.

---

## 7. Commandes utiles

```powershell
cd c:\laragon\www\RestaurantOS
git checkout feat/admin-loyalty-rgpd-delete
git pull personal feat/admin-loyalty-rgpd-delete
git log -5 --oneline

# Preuves locales
cd server
npm run typecheck
npx jest src/tests/pos-session.test.ts src/tests/order-merge.test.ts src/tests/permissions.test.ts

# Deploy VPS
powershell -File deploy\scripts\pack-for-vps.ps1
```

---

## 8. Prompt de reprise (coller dans le nouveau chat RestaurantOS)

```text
Contexte : lire docs/BRIEF-REPRISE-2026-08-25.md §6 + docs/FAISABILITE-PLAN-URY.md
Branche : feat/admin-loyalty-rgpd-delete @ 5193cbb (déjà sur VPS)
État : P0→E clos. Ne pas rouvrir Stripe / client Vite / migration URY.
Samir = test VPS uniquement après commit+push+redeploy (pas de tâches agents).
Répartition : Cursor = doc P2, clean worktree, STRIPE env, merge F, push, pack-for-vps ;
Claude = audit PosCashSessionGate puis Phase F en worktree (feat/order-transfer).
P3 / merge main : GO Samir explicite.
```

---

## 9. Interdits rappel

- Pas de rewrite monolithe hors mini-spec
- Pas de code neuf dans `client/`
- Pas de 2ᵉ PSP hors `PaymentProvider` SumUp
- Jamais IA → root ; Policy / RBAC pour routes sensibles
