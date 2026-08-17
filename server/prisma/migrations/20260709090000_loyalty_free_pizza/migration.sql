-- Fidélité : récompense pizza (pas de valeur € par point) — idempotent pour BDD en drift
ALTER TABLE "LoyaltyProgram" ADD COLUMN IF NOT EXISTS "pointsForFreePizza" INTEGER NOT NULL DEFAULT 100;
UPDATE "LoyaltyProgram" SET "dinarPerPoint" = 0 WHERE "dinarPerPoint" > 1;
