-- Session de caisse (ouverture/fermeture) — pas de FK vers Order (fiscalement figé)
CREATE TYPE "PosSessionStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "PosSession" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "status" "PosSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingCashAmount" INTEGER NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closingCashAmount" INTEGER,
    "expectedCashAmount" INTEGER,
    "discrepancy" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PosSession_businessId_status_idx" ON "PosSession"("businessId", "status");
CREATE INDEX "PosSession_businessId_cashierId_idx" ON "PosSession"("businessId", "cashierId");

ALTER TABLE "PosSession" ADD CONSTRAINT "PosSession_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosSession" ADD CONSTRAINT "PosSession_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
