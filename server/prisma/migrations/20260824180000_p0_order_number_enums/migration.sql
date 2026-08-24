-- P0 : numéros de commande atomiques + enums statut + unique (businessId, orderNumber)

-- 1) Compteur commande (même table que tickets / factures)
ALTER TABLE "FiscalSequence" ADD COLUMN IF NOT EXISTS "nextOrderNo" INTEGER NOT NULL DEFAULT 1;

UPDATE "FiscalSequence" fs
SET "nextOrderNo" = sub.next_no
FROM (
  SELECT "businessId", COALESCE(MAX("orderNumber"), 0) + 1 AS next_no
  FROM "Order"
  GROUP BY "businessId"
) sub
WHERE sub."businessId" = fs."businessId";

INSERT INTO "FiscalSequence" ("businessId", "nextOrderNo")
SELECT o."businessId", COALESCE(MAX(o."orderNumber"), 0) + 1
FROM "Order" o
LEFT JOIN "FiscalSequence" fs ON fs."businessId" = o."businessId"
WHERE fs."businessId" IS NULL
GROUP BY o."businessId"
ON CONFLICT ("businessId") DO NOTHING;

-- 2) Déduplication orderNumber avant contrainte unique
DO $$
DECLARE
  r RECORD;
  next_no INT;
BEGIN
  FOR r IN
    SELECT id, "businessId"
    FROM (
      SELECT id, "businessId",
        ROW_NUMBER() OVER (PARTITION BY "businessId", "orderNumber" ORDER BY "createdAt", id) AS rn
      FROM "Order"
    ) t
    WHERE rn > 1
  LOOP
    SELECT COALESCE(MAX("orderNumber"), 0) + 1 INTO next_no
    FROM "Order"
    WHERE "businessId" = r."businessId";
    UPDATE "Order" SET "orderNumber" = next_no WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_businessId_orderNumber_key"
  ON "Order"("businessId", "orderNumber");

-- 3) Enums (données legacy PENDING → CONFIRMED)
CREATE TYPE "OrderStatus" AS ENUM (
  'PENDING_PAYMENT',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_ISSUE',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'REFUNDED');

CREATE TYPE "TableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED');

UPDATE "Order"
SET "status" = 'CONFIRMED'
WHERE "status" = 'PENDING' OR "status" IS NULL OR "status" = '';

UPDATE "Order"
SET "status" = 'CONFIRMED'
WHERE "status" NOT IN (
  'PENDING_PAYMENT', 'CONFIRMED', 'PREPARING', 'READY',
  'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_ISSUE', 'COMPLETED', 'CANCELLED'
);

UPDATE "Order"
SET "paymentStatus" = 'UNPAID'
WHERE "paymentStatus" IS NULL
   OR "paymentStatus" = ''
   OR "paymentStatus" NOT IN ('UNPAID', 'PAID', 'REFUNDED');

UPDATE "Table"
SET "status" = 'AVAILABLE'
WHERE "status" IS NULL
   OR "status" = ''
   OR "status" NOT IN ('AVAILABLE', 'OCCUPIED', 'RESERVED');

ALTER TABLE "Order"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "OrderStatus" USING ("status"::"OrderStatus"),
  ALTER COLUMN "status" SET DEFAULT 'CONFIRMED'::"OrderStatus";

ALTER TABLE "Order"
  ALTER COLUMN "paymentStatus" DROP DEFAULT,
  ALTER COLUMN "paymentStatus" TYPE "PaymentStatus" USING ("paymentStatus"::"PaymentStatus"),
  ALTER COLUMN "paymentStatus" SET DEFAULT 'UNPAID'::"PaymentStatus";

ALTER TABLE "Table"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "TableStatus" USING ("status"::"TableStatus"),
  ALTER COLUMN "status" SET DEFAULT 'AVAILABLE'::"TableStatus";
