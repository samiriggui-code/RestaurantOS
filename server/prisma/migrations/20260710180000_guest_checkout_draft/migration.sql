-- Panier web temporaire (pas de commande BDD avant paiement CB réussi)
CREATE TABLE "GuestCheckoutDraft" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "stripePaymentIntentId" TEXT,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestCheckoutDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuestCheckoutDraft_stripePaymentIntentId_key" ON "GuestCheckoutDraft"("stripePaymentIntentId");
CREATE INDEX "GuestCheckoutDraft_businessId_expiresAt_idx" ON "GuestCheckoutDraft"("businessId", "expiresAt");

ALTER TABLE "GuestCheckoutDraft" ADD CONSTRAINT "GuestCheckoutDraft_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
