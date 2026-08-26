-- Pont comptable Pennylane : cache client + suivi de synchronisation par facture.
ALTER TABLE "Invoice" ADD COLUMN "pennylaneCustomerId" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "pennylaneSyncedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "pennylaneSyncError" TEXT;
