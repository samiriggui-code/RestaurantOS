-- Marque le remboursement automatique quand un paiement SumUp a été capturé mais que la
-- commande n'a finalement pas pu être créée (créneau fermé entre-temps, article devenu
-- indisponible…) — évite de débiter un client sans commande ni trace de remboursement.

-- AlterTable
ALTER TABLE "GuestCheckoutDraft" ADD COLUMN "refundedAt" TIMESTAMP(3);
