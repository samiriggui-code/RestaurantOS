"use strict";
/**
 * Photos menu — pizzas uniquement, fichiers locaux vérifiés.
 * 1 slug = 1 fichier dans public/images/menu/{slug}.jpg
 * Remplacer par les visuels client (même nom de fichier).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATEGORY_HERO_SOURCES = exports.CATEGORY_HERO_IMAGES = exports.MENU_IMAGE_CATEGORY_IDS = exports.MENU_ITEM_STOCK_SOURCE = exports.MENU_ITEM_IMAGE_FILE = exports.PIZZA_ITEM_SLUGS = exports.PIZZA_STOCK_IMAGES = void 0;
exports.menuItemSlug = menuItemSlug;
exports.menuItemImagePath = menuItemImagePath;
exports.getCategoryHeroImage = getCategoryHeroImage;
exports.categoryShowsItemPhoto = categoryShowsItemPhoto;
const IMG = '/images/menu';
/** Visuels pizza vérifiés (dossier placeholder, copiés par scripts/fix-menu-images.mjs) */
exports.PIZZA_STOCK_IMAGES = [
    '/images/placeholder/margherita.jpg',
    '/images/placeholder/pepperoni-close.jpg',
    '/images/placeholder/pepperoni-slice.jpg',
    '/images/placeholder/tomato-basil.jpg',
    '/images/placeholder/cheese-pizza.jpg',
    '/images/placeholder/gourmet-pizza.jpg',
    '/images/placeholder/pizza-loaded.jpg',
    '/images/placeholder/white-pizza.jpg',
];
function slugify(value) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}
function menuItemSlug(categoryId, name) {
    return `${categoryId}-${slugify(name)}`;
}
/** Slugs pizza avec photo produit (31 articles) */
exports.PIZZA_ITEM_SLUGS = [
    'tomate-margherita',
    'tomate-classique',
    'tomate-fromagere',
    'tomate-bolognaise',
    'tomate-orientale',
    'tomate-vegetarienne',
    'tomate-calzone',
    'tomate-fermiere',
    'tomate-soufiya',
    'tomate-reine',
    'tomate-raclette',
    'tomate-cheddar',
    'tomate-napolitaine',
    'tomate-chorizo',
    'tomate-oceane',
    'tomate-pepperoni',
    'creme-cremeuse',
    'creme-chevre-miel',
    'creme-chicken',
    'creme-savoyarde',
    'creme-tartiflette',
    'creme-paysanne',
    'creme-gourmande',
    'creme-montagnarde',
    'z-pizzas-kebab',
    'z-pizzas-biggy-burger',
    'z-pizzas-7-fromages',
    'z-pizzas-sud-ouest',
    'z-pizzas-nordique',
    'z-pizzas-4-saisons',
    'z-pizzas-serrano',
];
/** Nom de fichier réel si différent du slug catalogue (photos client) */
exports.MENU_ITEM_IMAGE_FILE = {
    'tomate-chorizo': 'tomate-la-chorizo',
    'z-pizzas-kebab': 'z-pizzas-la-kebab',
    'z-pizzas-7-fromages': 'z-pizzas-la-7-fromages',
    'z-pizzas-sud-ouest': 'z-pizzas-la-sud-ouest',
};
/** Chaque pizza a un visuel distinct (rotation sur le pool vérifié) */
exports.MENU_ITEM_STOCK_SOURCE = Object.fromEntries(exports.PIZZA_ITEM_SLUGS.map((slug, i) => [slug, exports.PIZZA_STOCK_IMAGES[i % exports.PIZZA_STOCK_IMAGES.length]]));
function menuItemImagePath(categoryId, name) {
    const slug = menuItemSlug(categoryId, name);
    if (exports.PIZZA_ITEM_SLUGS.includes(slug)) {
        const file = exports.MENU_ITEM_IMAGE_FILE[slug] ?? slug;
        return `${IMG}/${file}.jpg`;
    }
    return '';
}
/** Catégories avec photo pizza sur les cartes produit */
exports.MENU_IMAGE_CATEGORY_IDS = new Set(['tomate', 'creme', 'z-pizzas']);
const CAT = '/images/categories';
/** Bannière en-tête pour chaque onglet du menu */
exports.CATEGORY_HERO_IMAGES = {
    tomate: `${CAT}/tomate.jpg`,
    creme: `${CAT}/creme.jpg`,
    'z-pizzas': `${CAT}/z-pizzas.jpg`,
    supplements: `${CAT}/supplements.jpg`,
    desserts: `${CAT}/desserts.jpg`,
    boissons: `${CAT}/boissons.jpg`,
    alcool: `${CAT}/alcool.jpg`,
};
/** Source locale pour générer les bannières (scripts/fix-menu-images.mjs) */
exports.CATEGORY_HERO_SOURCES = {
    tomate: '/images/placeholder/margherita.jpg',
    creme: '/images/placeholder/white-pizza.jpg',
    'z-pizzas': '/images/placeholder/gourmet-pizza.jpg',
    supplements: '/images/placeholder/pizza-loaded.jpg',
    desserts: '/images/placeholder/tiramisu.jpg',
    boissons: '/images/placeholder/drinks.jpg',
    alcool: '/images/placeholder/wine.jpg',
};
function getCategoryHeroImage(categoryId) {
    return exports.CATEGORY_HERO_IMAGES[categoryId] ?? `${CAT}/tomate.jpg`;
}
function categoryShowsItemPhoto(categoryId) {
    return exports.MENU_IMAGE_CATEGORY_IDS.has(categoryId);
}
//# sourceMappingURL=menu-images.js.map