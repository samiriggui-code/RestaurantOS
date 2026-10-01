-- Fondation rapprochement ventes/dépenses : cache local des transactions comptoir/en
-- ligne SumUp (chantiers 1+2 — facturation B2C à la demande) et des factures
-- fournisseurs Pennylane (chantier 3, indépendant, sens de lecture inverse).

-- CreateTable
CREATE TABLE "SumupTransaction" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sumupTransactionId" TEXT NOT NULL,
    "transactionCode" TEXT,
    "amountCents" INTEGER NOT NULL,
    "vatAmountCents" INTEGER,
    "feeAmountCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "paymentType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "productSummary" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "invoiceId" TEXT,
    "raw" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SumupTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PennylaneSupplierInvoice" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "pennylaneSupplierInvoiceId" INTEGER NOT NULL,
    "supplierId" INTEGER,
    "invoiceNumber" TEXT,
    "label" TEXT,
    "amountCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "date" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "paymentStatus" TEXT NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "accountingStatus" TEXT,
    "raw" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PennylaneSupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SumupTransaction_businessId_sumupTransactionId_key" ON "SumupTransaction"("businessId", "sumupTransactionId");

-- CreateIndex
CREATE INDEX "SumupTransaction_businessId_occurredAt_idx" ON "SumupTransaction"("businessId", "occurredAt");

-- CreateIndex
CREATE INDEX "SumupTransaction_businessId_invoiceId_idx" ON "SumupTransaction"("businessId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PennylaneSupplierInvoice_businessId_pennylaneSupplierInvoi_key" ON "PennylaneSupplierInvoice"("businessId", "pennylaneSupplierInvoiceId");

-- CreateIndex
CREATE INDEX "PennylaneSupplierInvoice_businessId_date_idx" ON "PennylaneSupplierInvoice"("businessId", "date");

-- CreateIndex
CREATE INDEX "PennylaneSupplierInvoice_businessId_paymentStatus_idx" ON "PennylaneSupplierInvoice"("businessId", "paymentStatus");

-- AddForeignKey
ALTER TABLE "SumupTransaction" ADD CONSTRAINT "SumupTransaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
