import type { PrismaClient } from '@prisma/client'

const DEMO_NOTE = '[demo]'

type StockSeed = {
  name: string
  category: string
  unit: string
  quantity: number
  reorderAt: number
  costCents: number
}

/** Stock type pizzeria — matières premières, boissons, emballage. */
export const PIZZERIA_STOCK_ITEMS: StockSeed[] = [
  // Fromages
  { name: 'Mozzarella fior di latte 2,5 kg', category: 'Fromages', unit: 'kg', quantity: 18, reorderAt: 8, costCents: 890 },
  { name: 'Emmental râpé 1 kg', category: 'Fromages', unit: 'kg', quantity: 6, reorderAt: 3, costCents: 620 },
  { name: 'Chèvre frais', category: 'Fromages', unit: 'kg', quantity: 2.5, reorderAt: 1, costCents: 1450 },
  { name: 'Gorgonzola', category: 'Fromages', unit: 'kg', quantity: 1.8, reorderAt: 0.8, costCents: 1680 },
  // Viandes & charcuterie
  { name: 'Jambon blanc tranché', category: 'Viandes', unit: 'kg', quantity: 4.2, reorderAt: 2, costCents: 980 },
  { name: 'Chorizo doux', category: 'Viandes', unit: 'kg', quantity: 2.1, reorderAt: 1, costCents: 1120 },
  { name: 'Lardons fumés', category: 'Viandes', unit: 'kg', quantity: 3, reorderAt: 1.5, costCents: 890 },
  { name: 'Viande hachée bœuf', category: 'Viandes', unit: 'kg', quantity: 5, reorderAt: 2, costCents: 1050 },
  // Légumes & bases
  { name: 'Sauce tomate professionnelle 3 kg', category: 'Bases', unit: 'seau', quantity: 4, reorderAt: 2, costCents: 780 },
  { name: 'Crème fraîche liquide 1 L', category: 'Bases', unit: 'L', quantity: 12, reorderAt: 6, costCents: 320 },
  { name: 'Champignons de Paris', category: 'Légumes', unit: 'kg', quantity: 3.5, reorderAt: 2, costCents: 450 },
  { name: 'Olives noires dénoyautées', category: 'Légumes', unit: 'kg', quantity: 2, reorderAt: 1, costCents: 680 },
  { name: 'Poivrons tricolores', category: 'Légumes', unit: 'kg', quantity: 4, reorderAt: 2, costCents: 390 },
  { name: 'Oignons rouges', category: 'Légumes', unit: 'kg', quantity: 6, reorderAt: 3, costCents: 180 },
  { name: 'Pesto basilic', category: 'Bases', unit: 'pot', quantity: 3, reorderAt: 1, costCents: 540 },
  // Pâte
  { name: 'Pâte à pizza Sénior 31 cm', category: 'Pâte', unit: 'pièce', quantity: 85, reorderAt: 40, costCents: 42 },
  { name: 'Pâte à pizza Méga 40 cm', category: 'Pâte', unit: 'pièce', quantity: 52, reorderAt: 25, costCents: 58 },
  { name: 'Pâte Supergéante 60×40', category: 'Pâte', unit: 'pièce', quantity: 18, reorderAt: 10, costCents: 95 },
  // Boissons (stock comptoir / livraison)
  { name: 'Coca-Cola 33 cl (pack 24)', category: 'Boissons', unit: 'pack', quantity: 8, reorderAt: 4, costCents: 1120 },
  { name: 'Oasis Tropical 33 cl (pack 24)', category: 'Boissons', unit: 'pack', quantity: 5, reorderAt: 3, costCents: 1080 },
  { name: 'Eau minérale 1,5 L (pack 6)', category: 'Boissons', unit: 'pack', quantity: 6, reorderAt: 3, costCents: 420 },
  { name: 'Bière Kronenbourg 33 cl (pack 24)', category: 'Boissons', unit: 'pack', quantity: 3, reorderAt: 2, costCents: 1890 },
  { name: 'Jus d\'orange 1 L', category: 'Boissons', unit: 'L', quantity: 8, reorderAt: 4, costCents: 220 },
  // Emballage
  { name: 'Boîtes pizza Sénior 31 cm', category: 'Emballage', unit: 'lot 50', quantity: 2, reorderAt: 1, costCents: 1850 },
  { name: 'Boîtes pizza Méga 40 cm', category: 'Emballage', unit: 'lot 50', quantity: 1, reorderAt: 1, costCents: 2150 },
  { name: 'Boîtes Supergéante 60×40', category: 'Emballage', unit: 'lot 25', quantity: 1, reorderAt: 1, costCents: 1680 },
  { name: 'Sacs livraison kraft', category: 'Emballage', unit: 'lot 100', quantity: 3, reorderAt: 1, costCents: 890 },
  { name: 'Serviettes papier', category: 'Emballage', unit: 'lot', quantity: 4, reorderAt: 2, costCents: 450 },
  // Hygiène & entretien
  { name: 'Film alimentaire', category: 'Hygiène', unit: 'rouleau', quantity: 6, reorderAt: 3, costCents: 380 },
  { name: 'Liquide vaisselle pro', category: 'Hygiène', unit: 'L', quantity: 4, reorderAt: 2, costCents: 520 },
  { name: 'Gants nitrile (boîte 100)', category: 'Hygiène', unit: 'boîte', quantity: 2, reorderAt: 1, costCents: 890 },
]

type ExpenseSeed = {
  description: string
  category: string
  amountCents: number
  daysAgo: number
  notes?: string
}

/** Dépenses démo — charges typiques pizzeria. */
export const PIZZERIA_EXPENSES: ExpenseSeed[] = [
  { description: 'Metro — fromages & charcuterie', category: 'Matières premières', amountCents: 84200, daysAgo: 2, notes: `${DEMO_NOTE} Livraison hebdo` },
  { description: 'Brf — légumes frais', category: 'Matières premières', amountCents: 31850, daysAgo: 3 },
  { description: 'Transgourmet — boissons pack', category: 'Boissons', amountCents: 45600, daysAgo: 5 },
  { description: 'Packaging Pro — cartons pizza', category: 'Emballage', amountCents: 18900, daysAgo: 8 },
  { description: 'EDF — électricité four', category: 'Énergie', amountCents: 52400, daysAgo: 12, notes: `${DEMO_NOTE} Facture mensuelle` },
  { description: 'Engie — gaz cuisson', category: 'Énergie', amountCents: 28700, daysAgo: 12 },
  { description: 'Entretien four à pizza', category: 'Maintenance', amountCents: 16500, daysAgo: 15 },
  { description: 'Réparation laminoir', category: 'Maintenance', amountCents: 32000, daysAgo: 22 },
  { description: 'Flyers distribution quartier', category: 'Marketing', amountCents: 8900, daysAgo: 18 },
  { description: 'Google Ads local', category: 'Marketing', amountCents: 12000, daysAgo: 25 },
  { description: 'Urssaf — charges sociales', category: 'Personnel', amountCents: 125000, daysAgo: 28, notes: `${DEMO_NOTE} Trimestre` },
  { description: 'Salaire extra vendredi-soir', category: 'Personnel', amountCents: 8500, daysAgo: 4 },
  { description: 'Assurance multirisque', category: 'Assurances', amountCents: 42000, daysAgo: 30 },
  { description: 'Location terminal CB', category: 'Fournitures', amountCents: 2900, daysAgo: 1 },
  { description: 'Essuie-tout & produits hygiène', category: 'Hygiène', amountCents: 6700, daysAgo: 6 },
]

export async function seedPizzeriaStock(prisma: PrismaClient, businessId: string) {
  let created = 0
  let updated = 0

  for (const item of PIZZERIA_STOCK_ITEMS) {
    const existing = await prisma.stockItem.findFirst({
      where: { businessId, name: item.name },
    })

    if (existing) {
      await prisma.stockItem.update({
        where: { id: existing.id },
        data: {
          category: item.category,
          unit: item.unit,
          reorderAt: item.reorderAt,
          costCents: item.costCents,
        },
      })
      updated += 1
    } else {
      const stockItem = await prisma.stockItem.create({
        data: {
          businessId,
          name: item.name,
          category: item.category,
          unit: item.unit,
          quantity: item.quantity,
          reorderAt: item.reorderAt,
          costCents: item.costCents,
        },
      })
      await prisma.stockMovement.create({
        data: {
          stockItemId: stockItem.id,
          type: 'IN',
          quantity: item.quantity,
          note: 'Stock initial seed',
        },
      })
      created += 1
    }
  }

  return { created, updated, total: PIZZERIA_STOCK_ITEMS.length }
}

export async function seedPizzeriaExpenses(prisma: PrismaClient, businessId: string) {
  const existingDemo = await prisma.expense.count({
    where: { businessId, notes: { startsWith: DEMO_NOTE } },
  })
  if (existingDemo > 0) {
    return { created: 0, skipped: true }
  }

  const now = Date.now()
  for (const exp of PIZZERIA_EXPENSES) {
    const date = new Date(now - exp.daysAgo * 24 * 60 * 60 * 1000)
    await prisma.expense.create({
      data: {
        businessId,
        description: exp.description,
        category: exp.category,
        amount: exp.amountCents,
        date,
        notes: exp.notes ?? DEMO_NOTE,
      },
    })
  }

  return { created: PIZZERIA_EXPENSES.length, skipped: false }
}
