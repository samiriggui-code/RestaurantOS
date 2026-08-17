/**
 * Photos menu — pizzas uniquement, fichiers locaux vérifiés.
 * 1 slug = 1 fichier dans public/images/menu/{slug}.jpg
 * Remplacer par les visuels client (même nom de fichier).
 */
/** Visuels pizza vérifiés (dossier placeholder, copiés par scripts/fix-menu-images.mjs) */
export declare const PIZZA_STOCK_IMAGES: readonly ["/images/placeholder/margherita.jpg", "/images/placeholder/pepperoni-close.jpg", "/images/placeholder/pepperoni-slice.jpg", "/images/placeholder/tomato-basil.jpg", "/images/placeholder/cheese-pizza.jpg", "/images/placeholder/gourmet-pizza.jpg", "/images/placeholder/pizza-loaded.jpg", "/images/placeholder/white-pizza.jpg"];
export declare function menuItemSlug(categoryId: string, name: string): string;
/** Slugs pizza avec photo produit (31 articles) */
export declare const PIZZA_ITEM_SLUGS: readonly ["tomate-margherita", "tomate-classique", "tomate-fromagere", "tomate-bolognaise", "tomate-orientale", "tomate-vegetarienne", "tomate-calzone", "tomate-fermiere", "tomate-soufiya", "tomate-reine", "tomate-raclette", "tomate-cheddar", "tomate-napolitaine", "tomate-chorizo", "tomate-oceane", "tomate-pepperoni", "creme-cremeuse", "creme-chevre-miel", "creme-chicken", "creme-savoyarde", "creme-tartiflette", "creme-paysanne", "creme-gourmande", "creme-montagnarde", "z-pizzas-kebab", "z-pizzas-biggy-burger", "z-pizzas-7-fromages", "z-pizzas-sud-ouest", "z-pizzas-nordique", "z-pizzas-4-saisons", "z-pizzas-serrano"];
/** Nom de fichier réel si différent du slug catalogue (photos client) */
export declare const MENU_ITEM_IMAGE_FILE: Partial<Record<(typeof PIZZA_ITEM_SLUGS)[number], string>>;
/** Chaque pizza a un visuel distinct (rotation sur le pool vérifié) */
export declare const MENU_ITEM_STOCK_SOURCE: Record<string, string>;
export declare function menuItemImagePath(categoryId: string, name: string): string;
/** Catégories avec photo pizza sur les cartes produit */
export declare const MENU_IMAGE_CATEGORY_IDS: Set<string>;
/** Bannière en-tête pour chaque onglet du menu */
export declare const CATEGORY_HERO_IMAGES: Record<string, string>;
/** Source locale pour générer les bannières (scripts/fix-menu-images.mjs) */
export declare const CATEGORY_HERO_SOURCES: Record<string, string>;
export declare function getCategoryHeroImage(categoryId: string): string;
export declare function categoryShowsItemPhoto(categoryId: string): boolean;
//# sourceMappingURL=menu-images.d.ts.map