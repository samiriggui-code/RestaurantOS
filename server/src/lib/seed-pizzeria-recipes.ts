import type { PrismaClient } from '@prisma/client';

/** BOM par défaut pizzas + boissons liées au stock seed — décompte alertes. */
export async function seedPizzeriaStockRecipes(
  prisma: PrismaClient,
  businessId: string
): Promise<{ linked: number; recipes: number; menuItems: number }> {
  const stockByName = new Map(
    (
      await prisma.stockItem.findMany({
        where: { businessId, isActive: true },
        select: { id: true, name: true, menuItemId: true },
      })
    ).map(s => [s.name, s])
  );

  const pateSenior = stockByName.get('Pâte à pizza Sénior 31 cm');
  const pateMega = stockByName.get('Pâte à pizza Méga 40 cm');
  const pateSuper = stockByName.get('Pâte Supergéante 60×40');
  const sauce = stockByName.get('Sauce tomate professionnelle 3 kg');
  const mozza = stockByName.get('Mozzarella fior di latte 2,5 kg');
  const cartonSenior = stockByName.get('Boîtes pizza Sénior 31 cm');
  const cartonMega = stockByName.get('Boîtes pizza Méga 40 cm');

  const menuItems = await prisma.menuItem.findMany({
    where: { isActive: true, category: { businessId } },
    include: { category: { select: { slug: true, name: true } } },
  });

  let linked = 0;
  let recipes = 0;

  for (const item of menuItems) {
    const slug = item.category?.slug?.toLowerCase() ?? '';
    const catName = item.category?.name?.toLowerCase() ?? '';
    const isPizza = slug.includes('pizza') || catName.includes('pizza');
    const isBoisson =
      slug.includes('boisson') || catName.includes('boisson') || slug.includes('drink');

    // Lien direct stock ↔ menu (boissons pack)
    if (isBoisson) {
      const stock = [...stockByName.values()].find(s => {
        const n = s.name.toLowerCase();
        const mn = item.name.toLowerCase();
        return (
          (n.includes('coca') && mn.includes('coca')) ||
          (n.includes('oasis') && mn.includes('oasis')) ||
          (n.includes('eau') && mn.includes('eau')) ||
          (n.includes('kronenbourg') && mn.includes('bière')) ||
          (n.includes('jus') && mn.includes('jus'))
        );
      });
      if (stock && !stock.menuItemId) {
        await prisma.stockItem.update({
          where: { id: stock.id },
          data: { menuItemId: item.id },
        });
        linked += 1;
      }
      continue;
    }

    if (!isPizza) continue;

    const existing = await prisma.menuItemRecipe.count({ where: { menuItemId: item.id } });
    if (existing > 0) continue;

    const name = item.name.toLowerCase();
    const pate =
      name.includes('méga') || name.includes('mega')
        ? pateMega
        : name.includes('super') || name.includes('géante') || name.includes('geante')
          ? pateSuper
          : pateSenior;

    const toCreate: { stockItemId: string; quantity: number }[] = [];
    if (pate) toCreate.push({ stockItemId: pate.id, quantity: 1 });
    if (sauce) toCreate.push({ stockItemId: sauce.id, quantity: 0.12 });
    if (mozza) toCreate.push({ stockItemId: mozza.id, quantity: 0.22 });
    const carton = pate === pateMega ? cartonMega : cartonSenior;
    if (carton) toCreate.push({ stockItemId: carton.id, quantity: 0.02 });

    for (const row of toCreate) {
      await prisma.menuItemRecipe.create({
        data: { menuItemId: item.id, stockItemId: row.stockItemId, quantity: row.quantity },
      });
      recipes += 1;
    }
  }

  return { linked, recipes, menuItems: menuItems.length };
}

/** Idempotent — appelable depuis admin ou seed. */
export function syncDefaultPizzeriaRecipes(
  prisma: PrismaClient,
  businessId: string
): ReturnType<typeof seedPizzeriaStockRecipes> {
  return seedPizzeriaStockRecipes(prisma, businessId);
}
