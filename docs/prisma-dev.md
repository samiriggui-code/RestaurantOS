# Prisma — dev local Laragon (sans prise de tête)

## Une seule commande quand ça casse

À la racine du repo :

```powershell
npm run db:repair
npm run db:seed
```

Ça :
1. stoppe les ports dev (évite `EPERM` sur `prisma generate`)
2. détecte le **drift** (colonne déjà en BDD mais migration en échec)
3. marque les migrations concernées comme `applied`
4. lance `migrate deploy` + `generate`

## Ne pas faire

- **Ne pas** coller `<nom_migration>` littéralement — c’était un placeholder dans la doc
- **Ne pas** mélanger `db push` et `migrate deploy` au hasard (ça crée du drift)
- **Ne pas** lancer `prisma generate` pendant que `npm run dev` tourne (fichiers verrouillés Windows)

## Workflow normal après un `git pull`

```powershell
npm run db:repair
npm run dev
```

## Reset complet (dev jetable uniquement)

Efface toutes les données :

```powershell
cd server
npx prisma migrate reset
```

## Erreurs fréquentes

| Erreur | Cause | Fix |
|--------|--------|-----|
| `P3018` colonne existe déjà | drift | `npm run db:repair` |
| `P2022` colonne absente | migrations pas appliquées | `npm run db:repair` puis seed |
| `EPERM` prisma generate | dev server actif | `npm run dev:stop` puis repair |
