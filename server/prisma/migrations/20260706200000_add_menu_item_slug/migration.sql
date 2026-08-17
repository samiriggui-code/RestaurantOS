-- AlterTable: slug catalogue (nullable — lignes existantes conservées)
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Aligné avec @@unique([categoryId, slug]) dans schema.prisma
CREATE UNIQUE INDEX IF NOT EXISTS "MenuItem_categoryId_slug_key"
  ON "MenuItem"("categoryId", "slug");
