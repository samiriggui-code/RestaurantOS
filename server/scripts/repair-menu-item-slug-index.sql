-- Répare l'index slug MenuItem : la migration manuelle utilisait un index PARTIEL
-- (WHERE slug IS NOT NULL) alors que Prisma @@unique attend un index standard.
DROP INDEX IF EXISTS "MenuItem_categoryId_slug_key";

CREATE UNIQUE INDEX "MenuItem_categoryId_slug_key"
  ON "MenuItem"("categoryId", "slug");
