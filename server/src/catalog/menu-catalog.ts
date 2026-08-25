/**
 * Carte La Z Pizza — source : flyer / menu physique (2024), mise à jour 2026-08-25 avec
 * l'export catalogue SumUp Caisse (fichier client définitif) : noms/prix corrigés, 12 pizzas
 * ajoutées (La Chef, Milano, La Régale, La Mortadela, Spianata, La Fraichka, La Royale,
 * La Spéciale, La Buffalo, La Monster, La Blindée, La Hawaïenne).
 *
 * Prix pizza = taille 31 cm (Sénior). Les tailles 40/50/60×40 cm sont générées automatiquement
 * par `syncPizzaSizeModifiers` (modificateur « Taille ») à partir de la grille tarifaire
 * `catalog/pizza-sizes.ts`, qui reprend exactement les paliers du CSV SumUp (11/12/13.5/16.5 €).
 * Ne PAS dupliquer les tailles ici en articles séparés — ça casserait ce mécanisme.
 */

import { menuItemImagePath, menuItemSlug } from './menu-images';

export type CatalogItem = {
  slug: string;
  name: string;
  description: string;
  price: number;
  priceNote?: string;
  image: string;
};

export type CatalogCategory = {
  id: string;
  name: string;
  shortLabel: string;
  description?: string;
  items: CatalogItem[];
};

type RawItem = Omit<CatalogItem, 'slug' | 'image'> & {
  /** Slug stable si le libellé affiché diffère du flyer (ex. « La Chorizo » → tomate-chorizo) */
  catalogSlug?: string;
};
type RawCategory = Omit<CatalogCategory, 'items' | 'shortLabel'> & {
  items: RawItem[];
  shortLabel?: string;
};

const DESCRIPTION_TODO =
  'Description à compléter avec le client — ingrédients non communiqués pour cette pizza';

const PIZZA_SIZE_NOTE =
  'Prix Sénior 31 cm — Méga 40 cm, Suprema 50 cm et Supergéante 60×40 cm disponibles';

const RAW_MENU: RawCategory[] = [
  {
    id: 'tomate',
    name: 'Pizza base sauce tomate',
    shortLabel: 'Tomate',
    description: PIZZA_SIZE_NOTE,
    items: [
      { name: 'Margherita', description: 'Tomate, mozzarella, olives, origan', price: 11 },
      { name: 'Classique', description: 'Tomate, mozzarella, jambon, origan', price: 12 },
      {
        name: 'Fromagère',
        description: 'Tomate, mozzarella, bleu, chèvre, emmental, origan',
        price: 12,
      },
      {
        name: 'Bolognaise',
        description: 'Tomate, mozzarella, viande hachée, poivrons, oignons, origan',
        price: 12,
      },
      {
        name: 'Oriental',
        catalogSlug: 'tomate-orientale',
        description: 'Tomate, mozzarella, merguez, champignons, œuf, olives, origan',
        price: 12,
      },
      {
        name: 'Végétarienne',
        description:
          "Tomate, mozzarella, poivrons, champignons, olives, origan, tomates cerises, pommes de terre, huile d'olive",
        price: 12,
      },
      {
        name: 'Calzone',
        description:
          'Tomate, mozzarella, pointe de crème fraîche, champignons, œuf, jambon ou thon, origan',
        price: 12,
      },
      {
        name: 'Fermière',
        description: 'Tomate, mozzarella, jambon, champignons, olives, origan',
        price: 12,
      },
      {
        name: 'Soufiya',
        description: 'Tomate, mozzarella, chorizo, merguez, œuf, origan',
        price: 13.5,
      },
      {
        name: 'Raclette',
        description: 'Tomate, mozzarella, jambon, pommes de terre, fromage à raclette, origan',
        price: 13.5,
      },
      {
        name: 'Cheddar',
        description: 'Tomate, mozzarella, viande hachée, cheddar, origan',
        price: 13.5,
      },
      {
        name: 'Napolitaine',
        description: 'Tomate, mozzarella, anchois, câpres, origan',
        price: 13.5,
      },
      {
        name: 'Reine',
        description: 'Tomate, mozzarella, jambon, lardons, pointe de crème fraîche, origan',
        price: 13.5,
      },
      {
        name: 'Océane',
        description: 'Tomate, mozzarella, thon, oignons, pointe de crème, origan',
        price: 13.5,
      },
      {
        name: 'Pepperoni',
        description: 'Tomate, mozzarella, pepperoni, poivrons, oignons, origan',
        price: 13.5,
      },
      {
        name: 'Chorizo',
        catalogSlug: 'tomate-chorizo',
        description: 'Tomate, mozzarella, chorizo, oignons, poivrons, champignons, origan',
        price: 13.5,
      },
    ],
  },
  {
    id: 'creme',
    name: 'Pizza base crème fraîche',
    shortLabel: 'Crème',
    description: PIZZA_SIZE_NOTE,
    items: [
      {
        name: 'Crémeuse',
        description: 'Crème fraîche, mozzarella, jambon, olives, persillade',
        price: 13.5,
      },
      {
        name: 'Chèvre Miel',
        description: 'Crème fraîche, mozzarella, chèvre, miel, persillade',
        price: 13.5,
      },
      {
        name: 'Chicken',
        description:
          'Crème fraîche, mozzarella, poulet rôti ou tikka, pommes de terre, œuf, persillade',
        price: 13.5,
      },
      {
        name: 'Savoyarde',
        description: 'Crème fraîche, mozzarella, jambon, oignons, fromage à raclette, persillade',
        price: 13.5,
      },
      {
        name: 'Tartiflette',
        description: 'Crème fraîche, mozzarella, lardons, pommes de terre, reblochon, persillade',
        price: 13.5,
      },
      {
        name: 'Paysanne',
        description: 'Crème fraîche, mozzarella, jambon, camembert, champignons, persillade',
        price: 13.5,
      },
      {
        name: 'Gourmande',
        description:
          'Crème fraîche, mozzarella, jambon, poulet, pommes de terre, oignons, œuf, persillade',
        price: 13.5,
      },
      {
        name: 'Montagnarde',
        description: 'Crème fraîche, mozzarella, viande hachée, bleu, chèvre, œuf, persillade',
        price: 13.5,
      },
      { name: 'La Chef', description: DESCRIPTION_TODO, price: 13.5 },
      { name: 'Milano', description: DESCRIPTION_TODO, price: 13.5 },
      { name: 'La Régale', description: DESCRIPTION_TODO, price: 13.5 },
    ],
  },
  {
    id: 'z-pizzas',
    name: 'Les Z Pizzas',
    shortLabel: 'Z Pizzas',
    description: `${PIZZA_SIZE_NOTE}. Offre méga 18 € lun–jeu hors Z Pizzas.`,
    items: [
      {
        name: 'Kebab',
        catalogSlug: 'z-pizzas-kebab',
        description:
          'Tomate, mozzarella, oignons, viande de kebab, pointe de crème fraîche, tomates cerises, olives, origan',
        price: 16.5,
      },
      {
        name: 'Biggy Burger',
        description:
          'Crème fraîche, mozzarella, œuf, viande burger, cornichon, origan, cheddar, sauce Biggy Burger',
        price: 16.5,
      },
      {
        name: '7 Fromages',
        catalogSlug: 'z-pizzas-7-fromages',
        description:
          'Crème fraîche, mozzarella, bleu, emmental, chèvre, reblochon, camembert, raclette, persillade',
        price: 16.5,
      },
      {
        name: '4 Saisons',
        description: 'Tomate, mozzarella, jambon à la truffe, champignons, artichauts, origan',
        price: 16.5,
      },
      {
        name: 'Serrano',
        description: 'Tomate, mozzarella, jambon serrano, roquette, amandes torréfiées, origan',
        price: 16.5,
      },
      {
        name: 'Sud Ouest',
        catalogSlug: 'z-pizzas-sud-ouest',
        description:
          'Tomate, mozzarella, lardons, magret, pommes de terre, origan, roquette, noix torréfiées',
        price: 16.5,
      },
      {
        name: 'Nordique',
        description: 'Tomate, mozzarella, saumon, roquette, boule de burrata, persillade',
        price: 16.5,
      },
      { name: 'La Mortadela', description: DESCRIPTION_TODO, price: 16.5 },
      { name: 'Spianata', description: DESCRIPTION_TODO, price: 16.5 },
      { name: 'La Fraichka', description: DESCRIPTION_TODO, price: 16.5 },
      { name: 'La Royale', description: DESCRIPTION_TODO, price: 16.5 },
      { name: 'La Spéciale', description: DESCRIPTION_TODO, price: 16.5 },
      { name: 'La Buffalo', description: DESCRIPTION_TODO, price: 16.5 },
      { name: 'La Monster', description: DESCRIPTION_TODO, price: 16.5 },
      { name: 'La Blindée', description: DESCRIPTION_TODO, price: 16.5 },
      { name: 'La Hawaïenne', description: DESCRIPTION_TODO, price: 16.5 },
    ],
  },
  {
    id: 'supplements',
    name: 'Suppléments',
    shortLabel: 'Extras',
    description: 'Tarifs selon la taille de pizza (31 / 40 / 50 / 60×40 cm)',
    items: [
      {
        name: 'Viande + Fromage',
        catalogSlug: 'supplements-viande-fromage',
        description: 'Ajout viande ou fromage',
        price: 2.5,
        priceNote: '31 cm — jusqu’à 5,50 € en méga',
      },
      {
        name: 'Légumes',
        description: 'Ajout légumes',
        price: 1,
        priceNote: '31 cm — jusqu’à 4 € en méga',
      },
      { name: 'Pizza Moitié / Moitié', description: 'Deux goûts sur une même pizza', price: 2 },
      {
        name: 'Pâte Cheezy',
        catalogSlug: 'supplements-pate-cheezy',
        description: 'Bordure fromage',
        price: 3,
        priceNote: '31 cm — jusqu’à 6 € en méga',
      },
      {
        name: 'Magret / Jambon Truffe / Jambon Serrano',
        catalogSlug: 'supplements-magret-jambon-truffe-ou-serrano',
        description: 'Supplément premium',
        price: 3,
        priceNote: '31 cm — jusqu’à 6 € en méga',
      },
    ],
  },
  {
    id: 'desserts',
    name: 'Desserts',
    shortLabel: 'Desserts',
    items: [
      { name: 'Tiramisu caramel', description: 'Tiramisu', price: 3.5 },
      { name: 'Tiramisu choco', description: 'Tiramisu', price: 3.5 },
      { name: 'Tiramisu oréo', description: 'Tiramisu', price: 3.5 },
      { name: 'Tiramisu maison', description: 'Recette maison', price: 4.5 },
      { name: 'Tarte Snickers', description: 'Tarte', price: 3.5 },
      { name: 'Tarte Daim', description: 'Tarte', price: 3.5 },
    ],
  },
  {
    id: 'boissons',
    name: 'Boissons',
    shortLabel: 'Boissons',
    items: [
      { name: 'Coca (canette)', description: '33 cl', price: 2 },
      { name: 'Ice Tea (canette)', description: '33 cl', price: 2 },
      { name: 'Pepsi (canette)', description: '33 cl', price: 2 },
      { name: 'Coca 1,25 L', description: 'Bouteille', price: 3.5 },
    ],
  },
  {
    id: 'alcool',
    name: 'Alcool',
    shortLabel: 'Alcool',
    items: [
      {
        name: 'Bouteille Alcool (Rosé / Rouge / Blanc)',
        description: 'Selon arrivage — rosé, rouge ou blanc',
        price: 8,
        catalogSlug: 'alcool-bouteille',
      },
    ],
  },
];

const SHORT_LABELS: Record<string, string> = {
  tomate: 'Tomate',
  creme: 'Crème',
  'z-pizzas': 'Z Pizzas',
  supplements: 'Extras',
  desserts: 'Desserts',
  boissons: 'Boissons',
  alcool: 'Alcool',
};

export const LAZ_PIZZA_MENU: CatalogCategory[] = RAW_MENU.map(cat => ({
  ...cat,
  shortLabel: cat.shortLabel ?? SHORT_LABELS[cat.id] ?? cat.name,
  items: cat.items.map(item => {
    const slug = item.catalogSlug ?? menuItemSlug(cat.id, item.name);
    return {
      ...item,
      slug,
      image: menuItemImagePath(cat.id, item.name, slug),
    };
  }),
}));

export const PIZZA_CATEGORY_IDS = new Set(['tomate', 'creme', 'z-pizzas']);

/** Slugs catégories flyer officiel (CRM + sync). */
export const LAZ_PIZZA_CATEGORY_SLUGS = RAW_MENU.map(c => c.id);

export function formatPriceEUR(price: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
}
