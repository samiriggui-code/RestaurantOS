# Amendement CDC v2.2 — Internationalisation (Phase 3)

**Date :** juillet 2026  
**Statut :** Accepté pour V1  
**Référence :** `cahier-des-charges-pizzeria-v2.md` Phase 3

---

## Décision

Le CDC v2.2 prévoit **next-intl** pour l'interface française. Pour la V1 La Z Pizza :

| Exigence CDC | Décision V1 |
|--------------|-------------|
| Interface 100 % française | ✅ **Respectée** — textes FR en dur dans `app.pizzeria.fr/` |
| Devise EUR centimes | ✅ **Respectée** — `formatEUR()`, Prisma `Int` |
| Framework **next-intl** | ⏸️ **Reporté V1.1** — pas de bilinguisme client requis |

---

## Justification

1. **Pizzeria mono-langue** — aucun besoin AR/EN en production.
2. **Couverture actuelle** — landing, checkout, POS, KDS, admin, livreur déjà en français.
3. **Coût / risque** — migration next-intl ~1–2 j sans gain UX immédiat.
4. **Champs `nameAr` Prisma** — conservés (socle MIT) mais masqués de l'UI publique V1.

---

## Critère recette §9.9

**Validé** si :
- Aucune chaîne utilisateur visible en anglais/arabe sur les parcours V1
- Montants affichés en EUR avec format `fr-FR`

**Non bloquant** : absence de couche next-intl tant que cet amendement est signé.

---

## V1.1 (optionnel)

- Intégrer `next-intl` si ouverture second point ou export white-label
- Extraire les constantes `admin-nav.ts`, `ops-orders.ts`, composants landing
