-- Numérotation des factures : ancien code lisait MAX(invoiceNumber)+1 sans verrou,
-- ce qui pouvait produire un conflit (ou un échec silencieux) quand deux caisses
-- encaissent en même temps. On réutilise le compteur par business déjà verrouillé
-- via upsert pour FiscalSequence.nextTicketNo (cf. src/lib/fiscal/ticket.ts).

ALTER TABLE "FiscalSequence" ADD COLUMN IF NOT EXISTS "nextInvoiceNo" INTEGER NOT NULL DEFAULT 1;

-- Backfill : business avec des factures existantes -> repartir juste après le numéro max actuel.
UPDATE "FiscalSequence" fs
SET "nextInvoiceNo" = sub.next_no
FROM (
  SELECT "businessId", COALESCE(MAX("invoiceNumber"), 0) + 1 AS next_no
  FROM "Invoice"
  GROUP BY "businessId"
) sub
WHERE sub."businessId" = fs."businessId";

-- Business avec des factures mais sans ligne FiscalSequence (aucun ticket fiscal émis pour l'instant).
INSERT INTO "FiscalSequence" ("businessId", "nextInvoiceNo")
SELECT i."businessId", COALESCE(MAX(i."invoiceNumber"), 0) + 1
FROM "Invoice" i
LEFT JOIN "FiscalSequence" fs ON fs."businessId" = i."businessId"
WHERE fs."businessId" IS NULL
GROUP BY i."businessId"
ON CONFLICT ("businessId") DO NOTHING;
