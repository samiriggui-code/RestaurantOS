import type { PrismaClient } from '@prisma/client'
import {
  PIZZA_SIZES,
  priceForPizzaSize,
  type PizzaSizeId,
} from '../catalog/pizza-sizes'
const PIZZA_CATEGORY_SLUGS = ['tomate', 'creme', 'z-pizzas']
const MODIFIER_NAME = 'Taille'

export type PizzaModifiersSyncResult = {
  pizzas: number
  modifiers: number
  options: number
}

/**
 * Ajoute le modificateur « Taille » (31 / 40 / 50 / 60×40 cm) sur chaque pizza du flyer.
 * Les suppléments sont calculés par rapport au prix base 31 cm déjà en MenuItem.price.
 */
export async function syncPizzaSizeModifiers(
  prisma: PrismaClient,
  businessId: string
): Promise<PizzaModifiersSyncResult> {
  let pizzas = 0
  let modifiers = 0
  let options = 0

  const categories = await prisma.menuCategory.findMany({
    where: { businessId, slug: { in: PIZZA_CATEGORY_SLUGS }, isActive: true },
    include: { items: { where: { isActive: true, slug: { not: '__snapshot__' } } } },
  })

  for (const category of categories) {
    for (const item of category.items) {
      pizzas += 1
      const baseEuros = item.price / 100

      let modifier = await prisma.menuModifier.findFirst({
        where: { menuItemId: item.id, name: MODIFIER_NAME },
        include: { options: true },
      })

      if (!modifier) {
        modifier = await prisma.menuModifier.create({
          data: {
            menuItemId: item.id,
            name: MODIFIER_NAME,
            type: 'SINGLE',
            required: true,
            min: 1,
            max: 1,
          },
          include: { options: true },
        })
        modifiers += 1
      }

      let sort = 0
      for (const size of PIZZA_SIZES) {
        sort += 1
        const fullPrice = priceForPizzaSize(baseEuros, size.id as PizzaSizeId)
        const supplementCents = Math.round((fullPrice - baseEuros) * 100)
        const label = size.seniorLabel ? `${size.label} (${size.seniorLabel})` : size.label

        const existing = modifier.options.find((o) => o.name.startsWith(size.label))
        if (existing) {
          await prisma.modifierOption.update({
            where: { id: existing.id },
            data: { name: label, price: supplementCents, sortOrder: sort },
          })
        } else {
          await prisma.modifierOption.create({
            data: {
              modifierId: modifier.id,
              name: label,
              price: supplementCents,
              sortOrder: sort,
            },
          })
          options += 1
        }
      }
    }
  }

  return { pizzas, modifiers, options }
}
