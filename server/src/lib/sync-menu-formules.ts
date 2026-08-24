import type { PrismaClient } from '@prisma/client';
import {
  FORMULE_DESSERT_PRICE,
  FORMULE_DESSERT_SLUGS,
  FORMULE_DRINK_PRICE,
  FORMULE_DRINK_SLUGS,
  MENU_FORMULE,
  MENU_FORMULE_DESSERT,
} from '../catalog/menu-formules';
import { parseBusinessSettings } from './business-settings';

export type FormuleConfig = {
  id: string;
  name: string;
  tagline: string;
  savingsLabel: string;
  priceEuros: number;
  priceCents: number;
  eligibleSlugs: string[];
  offerTag: string;
  requiresPizza: boolean;
};

export type MenuFormulesConfig = {
  duo: FormuleConfig;
  dessert: FormuleConfig;
};

const MODIFIER_NAME = 'Formule menu';

function buildConfig(): MenuFormulesConfig {
  return {
    duo: {
      id: MENU_FORMULE.id,
      name: MENU_FORMULE.name,
      tagline: MENU_FORMULE.tagline,
      savingsLabel: MENU_FORMULE.savingsLabel,
      priceEuros: FORMULE_DRINK_PRICE,
      priceCents: Math.round(FORMULE_DRINK_PRICE * 100),
      eligibleSlugs: [...FORMULE_DRINK_SLUGS],
      offerTag: 'formule-duo',
      requiresPizza: true,
    },
    dessert: {
      id: MENU_FORMULE_DESSERT.id,
      name: MENU_FORMULE_DESSERT.name,
      tagline: MENU_FORMULE_DESSERT.tagline,
      savingsLabel: MENU_FORMULE_DESSERT.savingsLabel,
      priceEuros: FORMULE_DESSERT_PRICE,
      priceCents: Math.round(FORMULE_DESSERT_PRICE * 100),
      eligibleSlugs: [...FORMULE_DESSERT_SLUGS],
      offerTag: 'formule-dessert',
      requiresPizza: true,
    },
  };
}

async function upsertFormuleModifier(
  prisma: PrismaClient,
  menuItemId: string,
  formulePriceCents: number,
  catalogPriceCents: number
): Promise<void> {
  const supplement = formulePriceCents - catalogPriceCents;

  let modifier = await prisma.menuModifier.findFirst({
    where: { menuItemId, name: MODIFIER_NAME },
    include: { options: true },
  });

  if (!modifier) {
    modifier = await prisma.menuModifier.create({
      data: {
        menuItemId,
        name: MODIFIER_NAME,
        type: 'SINGLE',
        required: false,
        min: 0,
        max: 1,
      },
      include: { options: true },
    });
  }

  const optionName = `Prix menu (${(formulePriceCents / 100).toFixed(2).replace('.', ',')} €)`;
  const existing = modifier.options.find(o => o.name.startsWith('Prix menu'));
  if (existing) {
    await prisma.modifierOption.update({
      where: { id: existing.id },
      data: { name: optionName, price: supplement, sortOrder: 1 },
    });
  } else {
    await prisma.modifierOption.create({
      data: {
        modifierId: modifier.id,
        name: optionName,
        price: supplement,
        sortOrder: 1,
      },
    });
  }
}

export type FormulesSyncResult = {
  config: MenuFormulesConfig;
  drinkModifiers: number;
  dessertModifiers: number;
};

/** Persiste les formules dans Business.settings + modificateurs sur articles éligibles. */
export async function syncMenuFormules(
  prisma: PrismaClient,
  businessId: string
): Promise<FormulesSyncResult> {
  const config = buildConfig();
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  const settings = parseBusinessSettings(business?.settings);

  await prisma.business.update({
    where: { id: businessId },
    data: {
      settings: { ...settings, formules: config },
    },
  });

  let drinkModifiers = 0;
  let dessertModifiers = 0;

  for (const slug of config.duo.eligibleSlugs) {
    const item = await prisma.menuItem.findFirst({
      where: { slug, category: { businessId } },
    });
    if (!item) continue;
    await upsertFormuleModifier(prisma, item.id, config.duo.priceCents, item.price);
    drinkModifiers += 1;
  }

  for (const slug of config.dessert.eligibleSlugs) {
    const item = await prisma.menuItem.findFirst({
      where: { slug, category: { businessId } },
    });
    if (!item) continue;
    await upsertFormuleModifier(prisma, item.id, config.dessert.priceCents, item.price);
    dessertModifiers += 1;
  }

  return { config, drinkModifiers, dessertModifiers };
}

export function getFormulesFromSettings(raw: unknown): MenuFormulesConfig | null {
  const settings = parseBusinessSettings(raw);
  const f = (settings as { formules?: MenuFormulesConfig }).formules;
  if (!f?.duo?.eligibleSlugs || !f?.dessert?.eligibleSlugs) return null;
  return f;
}

export async function validateFormuleLines(
  prisma: PrismaClient,
  businessId: string,
  lines: Array<{ slug: string; unitPrice: number; offerTag?: string }>
): Promise<string | null> {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  const formules = getFormulesFromSettings(business?.settings);
  if (!formules) return null;

  for (const line of lines) {
    if (!line.offerTag) continue;

    if (line.offerTag === formules.duo.offerTag || line.offerTag === 'menu_drink') {
      if (!formules.duo.eligibleSlugs.includes(line.slug)) {
        return 'Boisson non éligible au menu';
      }
      if (Math.abs(line.unitPrice - formules.duo.priceEuros) > 0.05) {
        return 'Prix formule boisson invalide';
      }
    }

    if (line.offerTag === formules.dessert.offerTag || line.offerTag === 'menu_dessert') {
      if (!formules.dessert.eligibleSlugs.includes(line.slug)) {
        return 'Dessert non éligible au menu';
      }
      if (Math.abs(line.unitPrice - formules.dessert.priceEuros) > 0.05) {
        return 'Prix formule dessert invalide';
      }
    }
  }

  return null;
}
