import type { Prisma, PrismaClient } from '@prisma/client'
import { LAZ_PIZZA_MENU, LAZ_PIZZA_CATEGORY_SLUGS } from '../catalog/menu-catalog'
const euro = (amount: number) => Math.round(amount * 100)

function vatRateBpsForCategory(categoryId: string): number {
  return categoryId === 'alcool' ? 2000 : 1000
}

export const LAZ_PIZZA_CATALOG_EXPECTED = {
  categories: LAZ_PIZZA_MENU.length,
  items: LAZ_PIZZA_MENU.reduce((n, cat) => n + cat.items.length, 0),
}

/** Catégories CRM / public — flyer La Z Pizza uniquement (pas le menu démo legacy). */
export const FLYER_MENU_CATEGORY_FILTER: Prisma.MenuCategoryWhereInput = {
  slug: { in: [...LAZ_PIZZA_CATEGORY_SLUGS] },
}

/** Alias historique — même filtre flyer. */
export const INTERNAL_MENU_CATEGORY_FILTER = FLYER_MENU_CATEGORY_FILTER
export type CatalogSyncResult = {
  expectedCategories: number
  expectedItems: number
  categories: number
  items: number
}

/**
 * Importe / met à jour le catalogue flyer La Z Pizza dans MenuCategory + MenuItem.
 * Source seed : server/src/catalog/menu-catalog.ts (sync vers Prisma, pas runtime front). */
export async function syncLazPizzaCatalog(
  prisma: PrismaClient,
  businessId: string
): Promise<CatalogSyncResult> {
  let sortCat = 0
  for (const cat of LAZ_PIZZA_MENU) {
    sortCat += 1
    const existingCat = await prisma.menuCategory.findFirst({
      where: {
        businessId,
        OR: [{ slug: cat.id }, { name: cat.name }],
      },
    })

    const category = existingCat
      ? await prisma.menuCategory.update({
          where: { id: existingCat.id },
          data: {
            slug: cat.id,
            name: cat.name,
            description: cat.description ?? null,
            sortOrder: sortCat,
            isActive: true,
          },
        })
      : await prisma.menuCategory.create({
          data: {
            businessId,
            slug: cat.id,
            name: cat.name,
            description: cat.description ?? null,
            sortOrder: sortCat,
            isActive: true,
          },
        })

    let sortItem = 0
    const catalogSlugs = new Set<string>()
    for (const item of cat.items) {
      sortItem += 1
      catalogSlugs.add(item.slug)
      let existingItem = await prisma.menuItem.findFirst({
        where: { categoryId: category.id, slug: item.slug },
      })
      if (!existingItem) {
        existingItem = await prisma.menuItem.findFirst({
          where: { categoryId: category.id, name: item.name },
        })
      }

      const vatRateBps = vatRateBpsForCategory(cat.id)
      const itemData = {
        slug: item.slug,
        name: item.name,
        description: item.description,
        price: euro(item.price),
        image: item.image,
        sortOrder: sortItem,
        isActive: true,
        isAvailable: true,
        vatRateBps,
      }

      if (existingItem) {
        // Évite P2002 si un doublon porte déjà le slug cible
        if (existingItem.slug !== item.slug) {
          await prisma.menuItem.deleteMany({
            where: { categoryId: category.id, slug: item.slug, id: { not: existingItem.id } },
          })
        }
        await prisma.menuItem.update({
          where: { id: existingItem.id },
          data: itemData,
        })
      } else {
        await prisma.menuItem.create({
          data: {
            categoryId: category.id,
            ...itemData,
            prepTime: cat.id === 'boissons' || cat.id === 'alcool' ? 1 : 12,
          },
        })
      }
    }

    // Masquer les produits obsolètes (hors flyer) dans cette catégorie
    await prisma.menuItem.updateMany({
      where: {
        categoryId: category.id,
        isActive: true,
        OR: [{ slug: null }, { slug: { notIn: [...catalogSlugs, '__snapshot__'] } }],
      },
      data: { isActive: false, isAvailable: false },
    })
  }

  // Désactive catégories + articles hors flyer (menu démo Vite legacy « Pizzas », etc.)
  const legacyCategories = await prisma.menuCategory.findMany({
    where: {
      businessId,
      NOT: { name: 'Commande en ligne (interne)' },
      OR: [{ slug: null }, { slug: { notIn: [...LAZ_PIZZA_CATEGORY_SLUGS, '__snapshot__'] } }],
    },
    select: { id: true },
  })
  if (legacyCategories.length) {
    const legacyIds = legacyCategories.map((c) => c.id)
    await prisma.menuCategory.updateMany({
      where: { id: { in: legacyIds } },
      data: { isActive: false },
    })
    await prisma.menuItem.updateMany({
      where: { categoryId: { in: legacyIds } },
      data: { isActive: false, isAvailable: false },
    })
  }

  const categories = await prisma.menuCategory.count({
    where: { businessId, isActive: true, ...FLYER_MENU_CATEGORY_FILTER },
  })
  const items = await prisma.menuItem.count({
    where: {
      isActive: true,
      slug: { not: '__snapshot__' },
      category: { businessId, isActive: true, ...FLYER_MENU_CATEGORY_FILTER },
    },
  })

  return {
    expectedCategories: LAZ_PIZZA_CATALOG_EXPECTED.categories,
    expectedItems: LAZ_PIZZA_CATALOG_EXPECTED.items,
    categories,
    items,
  }
}

/** Zones livraison flyer → DeliveryZone */
export async function syncLazPizzaDeliveryZones(prisma: PrismaClient, businessId: string) {
  const { LAZ_PIZZA_DELIVERY_TOWNS } = await import('./delivery-quote')
  let sort = 0
  for (const town of LAZ_PIZZA_DELIVERY_TOWNS) {
    for (const postalCode of town.postalCodes) {
      sort += 1
      const existing = await prisma.deliveryZone.findFirst({
        where: { businessId, postalCode, city: town.name },
      })
      if (existing) {
        await prisma.deliveryZone.update({
          where: { id: existing.id },
          data: {
            feeCents: euro(town.fee),
            minOrderCents: euro(town.minOrder),
            sortOrder: sort,
            isActive: true,
          },
        })
      } else {
        await prisma.deliveryZone.create({
          data: {
            businessId,
            postalCode,
            city: town.name,
            feeCents: euro(town.fee),
            minOrderCents: euro(town.minOrder),
            sortOrder: sort,
            isActive: true,
          },
        })
      }
    }
  }
}
