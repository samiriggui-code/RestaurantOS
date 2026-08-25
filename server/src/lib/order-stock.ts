import type { Prisma, PrismaClient } from '@prisma/client';

type OrderLine = {
  menuItemId: string;

  quantity: number;
};

type Tx = Prisma.TransactionClient;

const OUT_REF = (orderId: string, stockItemId: string): string =>
  `order:${orderId}:OUT:${stockItemId}`;

const RESTORE_REF = (orderId: string, stockItemId: string): string =>
  `order:${orderId}:RESTORE:${stockItemId}`;

type StockDeduction = { stockItemId: string; quantity: number };

/** Recettes BOM + lien direct menuItemId → stockItem */

export async function deductionsForMenuLine(
  tx: Tx,

  businessId: string,

  menuItemId: string,

  lineQty: number
): Promise<StockDeduction[]> {
  const map = new Map<string, number>();

  const recipes = await tx.menuItemRecipe.findMany({
    where: { menuItemId, stockItem: { businessId, isActive: true } },

    include: { stockItem: true },
  });

  for (const recipe of recipes) {
    const add = recipe.quantity * lineQty;

    map.set(recipe.stockItemId, (map.get(recipe.stockItemId) ?? 0) + add);
  }

  const direct = await tx.stockItem.findMany({
    where: { businessId, menuItemId, isActive: true },
  });

  for (const stock of direct) {
    map.set(stock.id, (map.get(stock.id) ?? 0) + lineQty);
  }

  return [...map.entries()].map(([stockItemId, quantity]) => ({ stockItemId, quantity }));
}

async function applyStockOut(
  tx: Tx,

  orderId: string,

  stockItemId: string,

  qty: number
): Promise<string | null> {
  const ref = OUT_REF(orderId, stockItemId);

  const already = await tx.stockMovement.findFirst({ where: { note: ref } });

  if (already) return null;

  const stock = await tx.stockItem.findUnique({ where: { id: stockItemId } });

  if (!stock) return null;

  const newQty = stock.quantity - qty;

  await tx.stockItem.update({
    where: { id: stock.id },
    data: { quantity: newQty },
  });
  await tx.stockMovement.create({
    data: {
      stockItemId: stock.id,
      orderId,
      type: 'OUT',
      quantity: qty,
      note: newQty < 0 ? `${ref} — stock insuffisant` : ref,
    },
  });
  if (newQty < 0) {
    console.warn(`Stock insuffisant ${stock.name} pour commande ${orderId} (reste ${newQty})`);
  }
  return stockItemId;
}

/** Sortie stock (recettes + boissons/emballages liés) quand la commande part en cuisine. */

export async function deductStockForOrder(
  tx: Tx,

  businessId: string,

  orderId: string,

  items: OrderLine[]
): Promise<string[]> {
  const touched = new Set<string>();

  for (const line of items) {
    const deductions = await deductionsForMenuLine(tx, businessId, line.menuItemId, line.quantity);

    for (const { stockItemId, quantity } of deductions) {
      const id = await applyStockOut(tx, orderId, stockItemId, quantity);

      if (id) touched.add(id);
    }
  }

  return [...touched];
}

/** Remise en stock à l'annulation (miroir des sorties enregistrées). */

export async function restoreStockForOrder(
  tx: Tx,

  businessId: string,

  orderId: string,

  items: OrderLine[],

  cancelLabel: string
): Promise<void> {
  for (const line of items) {
    const deductions = await deductionsForMenuLine(tx, businessId, line.menuItemId, line.quantity);

    for (const { stockItemId } of deductions) {
      const outRef = OUT_REF(orderId, stockItemId);

      const outMove = await tx.stockMovement.findFirst({ where: { note: outRef } });

      if (!outMove) continue;

      const restoreRef = RESTORE_REF(orderId, stockItemId);

      const already = await tx.stockMovement.findFirst({ where: { note: restoreRef } });

      if (already) continue;

      const qty = outMove.quantity;

      await tx.stockItem.update({
        where: { id: stockItemId },

        data: { quantity: { increment: qty } },
      });

      await tx.stockMovement.create({
        data: {
          stockItemId,

          orderId,

          type: 'IN',

          quantity: qty,

          note: `${restoreRef} — ${cancelLabel}`,
        },
      });
    }
  }
}

/** Helper hors transaction (webhook, création commande). */

export async function deductStockForOrderStandalone(
  prisma: PrismaClient,

  businessId: string,

  orderId: string,

  items: OrderLine[]
): Promise<string[]> {
  return prisma.$transaction(tx => deductStockForOrder(tx, businessId, orderId, items));
}
