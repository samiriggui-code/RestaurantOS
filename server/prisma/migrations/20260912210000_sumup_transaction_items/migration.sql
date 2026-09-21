-- Détail article des ventes comptoir SumUp, alimenté par l'import manuel du "Rapport de
-- ventes" (l'API Cloud SumUp ne fournit jamais ce niveau de détail). Complète les rapports
-- "Ventes par article" / "CA par catégorie" qui, avant, n'incluaient que les commandes Order.

-- CreateTable
CREATE TABLE "SumupTransactionItem" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "quantity" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SumupTransactionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SumupTransactionItem_transactionId_idx" ON "SumupTransactionItem"("transactionId");

-- AddForeignKey
ALTER TABLE "SumupTransactionItem" ADD CONSTRAINT "SumupTransactionItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "SumupTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
