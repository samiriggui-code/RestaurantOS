-- Canal de vente : POS | WEB | DELIVEROO | UBER_EATS | KIOSK
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "channel" TEXT;

CREATE INDEX IF NOT EXISTS "Order_businessId_channel_createdAt_idx"
  ON "Order"("businessId", "channel", "createdAt");

-- Rétro-remplissage commandes existantes
UPDATE "Order" SET "channel" = 'WEB' WHERE "channel" IS NULL AND "isOnlineOrder" = true;
UPDATE "Order" SET "channel" = 'POS' WHERE "channel" IS NULL AND "isOnlineOrder" = false;
