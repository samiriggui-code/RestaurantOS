-- Pré-clôture journalière + snapshot rapprochement sur clôture Z
ALTER TABLE "FiscalClosure" ADD COLUMN IF NOT EXISTS "reconciliation" JSONB;

CREATE TABLE IF NOT EXISTS "FiscalDayPreclose" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "dayKey" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "checks" JSONB NOT NULL,
  "canClose" BOOLEAN NOT NULL,
  "blockerCount" INTEGER NOT NULL DEFAULT 0,
  "warningCount" INTEGER NOT NULL DEFAULT 0,
  "managerNotes" TEXT,
  "cashCountedCents" INTEGER,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedById" TEXT,
  "closureId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalDayPreclose_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FiscalDayPreclose_closureId_key" ON "FiscalDayPreclose"("closureId");
CREATE INDEX IF NOT EXISTS "FiscalDayPreclose_businessId_dayKey_idx" ON "FiscalDayPreclose"("businessId", "dayKey");
CREATE INDEX IF NOT EXISTS "FiscalDayPreclose_businessId_acknowledgedAt_idx" ON "FiscalDayPreclose"("businessId", "acknowledgedAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FiscalDayPreclose_businessId_fkey') THEN
    ALTER TABLE "FiscalDayPreclose" ADD CONSTRAINT "FiscalDayPreclose_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
