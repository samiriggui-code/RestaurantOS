-- Paiement carte en ligne : remplacement de Stripe par l'API Checkout SumUp.
-- Colonnes additives (on ne renomme/retouche jamais stripePaymentIntentId,
-- conservé tel quel pour l'historique des commandes déjà payées via Stripe).

ALTER TABLE "GuestCheckoutDraft" ADD COLUMN IF NOT EXISTS "sumupCheckoutId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "GuestCheckoutDraft_sumupCheckoutId_key" ON "GuestCheckoutDraft"("sumupCheckoutId");

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "sumupCheckoutId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_sumupCheckoutId_key" ON "Order"("sumupCheckoutId");
