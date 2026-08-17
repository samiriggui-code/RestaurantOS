-- Conformité article 286 CGI — idempotent (safe re-run / drift repair)

ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "vatRateBps" INTEGER NOT NULL DEFAULT 1000;

CREATE TABLE IF NOT EXISTS "FiscalSequence" (
    "businessId" TEXT NOT NULL,
    "nextTicketNo" INTEGER NOT NULL DEFAULT 1,
    "grandTotalCents" BIGINT NOT NULL DEFAULT 0,
    "lastTicketHash" TEXT,
    "lastEventHash" TEXT,
    "lastClosureHash" TEXT,
    "softwareVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "commissionedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FiscalSequence_pkey" PRIMARY KEY ("businessId")
);

CREATE TABLE IF NOT EXISTS "FiscalTicket" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "serialNumber" INTEGER NOT NULL,
    "orderId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'SALE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "offlineSoldAt" TIMESTAMP(3),
    "offlineRef" TEXT,
    "operatorId" TEXT,
    "paymentMethod" TEXT,
    "subtotalCents" INTEGER NOT NULL,
    "taxByRate" JSONB NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "previousHash" TEXT NOT NULL,
    "recordHash" TEXT NOT NULL,
    "reprintCount" INTEGER NOT NULL DEFAULT 0,
    "voidOfId" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FiscalTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FiscalClosure" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "totals" JSONB NOT NULL,
    "grandTotalCents" BIGINT NOT NULL,
    "ticketCount" INTEGER NOT NULL DEFAULT 0,
    "previousHash" TEXT NOT NULL,
    "recordHash" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" TEXT,
    CONSTRAINT "FiscalClosure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FiscalEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "operatorId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "payload" JSONB,
    "previousHash" TEXT NOT NULL,
    "recordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FiscalEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FiscalArchive" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exportedById" TEXT,
    CONSTRAINT "FiscalArchive_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FiscalTicket_businessId_serialNumber_key" ON "FiscalTicket"("businessId", "serialNumber");
CREATE INDEX IF NOT EXISTS "FiscalTicket_businessId_issuedAt_idx" ON "FiscalTicket"("businessId", "issuedAt");
CREATE INDEX IF NOT EXISTS "FiscalTicket_businessId_orderId_idx" ON "FiscalTicket"("businessId", "orderId");
CREATE INDEX IF NOT EXISTS "FiscalTicket_businessId_kind_idx" ON "FiscalTicket"("businessId", "kind");

CREATE UNIQUE INDEX IF NOT EXISTS "FiscalClosure_businessId_periodType_periodKey_key" ON "FiscalClosure"("businessId", "periodType", "periodKey");
CREATE INDEX IF NOT EXISTS "FiscalClosure_businessId_closedAt_idx" ON "FiscalClosure"("businessId", "closedAt");

CREATE INDEX IF NOT EXISTS "FiscalEvent_businessId_createdAt_idx" ON "FiscalEvent"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "FiscalEvent_businessId_eventType_idx" ON "FiscalEvent"("businessId", "eventType");

CREATE UNIQUE INDEX IF NOT EXISTS "FiscalArchive_businessId_fiscalYear_key" ON "FiscalArchive"("businessId", "fiscalYear");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FiscalSequence_businessId_fkey') THEN
    ALTER TABLE "FiscalSequence" ADD CONSTRAINT "FiscalSequence_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FiscalTicket_businessId_fkey') THEN
    ALTER TABLE "FiscalTicket" ADD CONSTRAINT "FiscalTicket_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FiscalTicket_orderId_fkey') THEN
    ALTER TABLE "FiscalTicket" ADD CONSTRAINT "FiscalTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FiscalClosure_businessId_fkey') THEN
    ALTER TABLE "FiscalClosure" ADD CONSTRAINT "FiscalClosure_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FiscalEvent_businessId_fkey') THEN
    ALTER TABLE "FiscalEvent" ADD CONSTRAINT "FiscalEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FiscalArchive_businessId_fkey') THEN
    ALTER TABLE "FiscalArchive" ADD CONSTRAINT "FiscalArchive_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION fiscal_deny_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Fiscal record is immutable (article 286 CGI)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fiscal_ticket_immutable ON "FiscalTicket";
CREATE TRIGGER fiscal_ticket_immutable
  BEFORE UPDATE OR DELETE ON "FiscalTicket"
  FOR EACH ROW EXECUTE FUNCTION fiscal_deny_mutation();

DROP TRIGGER IF EXISTS fiscal_closure_immutable ON "FiscalClosure";
CREATE TRIGGER fiscal_closure_immutable
  BEFORE UPDATE OR DELETE ON "FiscalClosure"
  FOR EACH ROW EXECUTE FUNCTION fiscal_deny_mutation();

DROP TRIGGER IF EXISTS fiscal_event_immutable ON "FiscalEvent";
CREATE TRIGGER fiscal_event_immutable
  BEFORE UPDATE OR DELETE ON "FiscalEvent"
  FOR EACH ROW EXECUTE FUNCTION fiscal_deny_mutation();

DROP TRIGGER IF EXISTS fiscal_archive_immutable ON "FiscalArchive";
CREATE TRIGGER fiscal_archive_immutable
  BEFORE UPDATE OR DELETE ON "FiscalArchive"
  FOR EACH ROW EXECUTE FUNCTION fiscal_deny_mutation();

CREATE OR REPLACE FUNCTION fiscal_sequence_deny_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Fiscal sequence cannot be deleted (article 286 CGI)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fiscal_sequence_no_delete ON "FiscalSequence";
CREATE TRIGGER fiscal_sequence_no_delete
  BEFORE DELETE ON "FiscalSequence"
  FOR EACH ROW EXECUTE FUNCTION fiscal_sequence_deny_delete();
