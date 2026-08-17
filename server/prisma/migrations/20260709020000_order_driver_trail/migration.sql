-- AlterTable (idempotent for drifted local DBs)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "driverId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "driverTrail" JSONB;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Order_driverId_fkey'
      AND table_name = 'Order'
  ) THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_driverId_fkey"
      FOREIGN KEY ("driverId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
