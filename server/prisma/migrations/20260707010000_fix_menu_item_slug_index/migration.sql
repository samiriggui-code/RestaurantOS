-- Corrige l'index partiel slug si la migration 20260706200000 a déjà tourné en dev.
DROP INDEX IF EXISTS "MenuItem_categoryId_slug_key";

CREATE UNIQUE INDEX IF NOT EXISTS "MenuItem_categoryId_slug_key"
  ON "MenuItem"("categoryId", "slug");
