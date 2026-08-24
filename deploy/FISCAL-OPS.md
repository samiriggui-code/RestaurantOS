# Exploitation fiscale ISCA — La Z Pizza

Référence : **article 286 du CGI** · **BOFiP BOI-TVA-DECLA-30-10-30** (caisse enregistreuse informatisée).

---

## 1. Paramètres à configurer (jour J production)

| Paramètre                        | Où                          | Rôle                                                                                     |
| -------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| **Date de mise en service ISCA** | Admin → Paramètres → Fiscal | Première journée où la clôture Z est exigée. Avant cette date : pas de clôture proposée. |
| **Mode formation**               | Idem                        | **OFF en production.** Tickets TRAINING exclus des clôtures Z.                           |
| **SIRET / TVA / raison sociale** | Paramètres → Établissement  | Mentions obligatoires sur ticket 58 mm.                                                  |
| **FISCAL_HMAC_SECRET**           | `.env` serveur              | Clé HMAC chaînage — **ne jamais changer** après mise en service (sinon rupture chaîne).  |
| **FISCAL_SOFTWARE_VERSION**      | `.env`                      | Version certifiée / déclarée du logiciel.                                                |
| **FISCAL_ALLOW_JET_REPAIR**      | `.env`                      | `false` en production. `true` labo uniquement.                                           |
| **FISCAL_REQUIRE_PRECLOSE**      | `.env`                      | `true` — pré-clôture obligatoire avant Z.                                                |

### Jour de la mise en production

1. Fixer la **date d’activation** = premier service réel avec cette caisse.
2. Désactiver le **mode formation**.
3. Vérifier **Fiscal ISCA → Contrôle chaîne** vert.
4. À la fin du premier service : **Pré-clôture & Z** sur la journée d’activation.

Les journées antérieures (tests, autre logiciel) ne doivent **pas** être clôturées dans ce système.

---

## 2. Sauvegardes (PostgreSQL + archives)

### Quotidien (script existant)

```bash
./deploy/scripts/backup-vps.sh
```

### Avec MinIO (stack ops)

```bash
export COMPOSE_FILE=docker-compose.yml:deploy/docker-compose.prod.yml:deploy/docker-compose.ops.yml
docker compose up -d minio
# Configurer MINIO_* dans .env puis :
./deploy/scripts/fiscal-backup-minio.sh
```

Buckets recommandés :

- `pizzeria-backups/postgres/` — dumps SQL gzip
- `pizzeria-backups/fiscal/` — exports annuels + tar archives JET

**Rétention** : 14 jours local + 90 jours MinIO (lifecycle policy).

En cas de redeploy : restaurer le dump **et** les archives fiscales ; ne pas réinitialiser `FISCAL_HMAC_SECRET`.

---

## 3. n8n — avis et cas d’usage

**Recommandation** : oui pour le labo et la prod, mais **en complément** de scripts bash/cron, pas en remplacement du cœur métier (clôture Z reste dans l’API Express).

| Workflow n8n        | Déclencheur | Action                                                          |
| ------------------- | ----------- | --------------------------------------------------------------- |
| Backup nocturne     | Cron 04:00  | Webhook → script backup + upload MinIO                          |
| Alerte chaîne rouge | Cron 30 min | GET `/api/fiscal/verify` (token service) → email si `ok: false` |
| Rappel clôture Z    | Cron 01:00  | Si veille non clôturée → notification admin                     |
| Export comptable    | Fin de mois | Export CSV heures + clôture M                                   |

Stack : `deploy/docker-compose.ops.yml` (MinIO + n8n).  
Sous-domaines labo : `minio.pizza.gsms-security.com`, `n8n.pizza.gsms-security.com`.

**Ne pas automatiser via n8n** : clôture Z elle-même (doit rester action humaine + pré-clôture).

---

## 4. Labo gsms — reset données

Une fois (puis `FISCAL_LAB_RESET=false`) :

```bash
FISCAL_LAB_RESET=true docker compose exec server npx tsx scripts/fiscal-lab-reset.ts
```

Conserve les **clôtures Z** existantes, supprime commandes/tickets/factures, reconstruit le JET.

---

## 5. Checklist client (première installation)

- [ ] DNS + Docker prod
- [ ] `.env` : secrets fiscaux uniques, `FISCAL_ALLOW_JET_REPAIR=false`
- [ ] Date activation ISCA = J1 production
- [ ] Mode formation OFF
- [ ] Backup cron + MinIO
- [ ] Test clôture Z J1
- [ ] Export archive annuelle planifié (31/12)
