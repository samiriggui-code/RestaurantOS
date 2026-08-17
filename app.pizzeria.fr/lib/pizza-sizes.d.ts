/** Tailles pizza La Z — grilles tarifaires flyer (prix fixes par palier) */
export type PizzaSizeId = '31' | '40' | '50' | '60x40';
export declare const PIZZA_SIZES: {
    id: PizzaSizeId;
    label: string;
    seniorLabel?: string;
}[];
/** Suppléments — prix par taille (flyer) */
export type SupplementPriceKey = 'meat-cheese' | 'veg' | 'cheezy' | 'premium';
export declare const SUPPLEMENT_PRICE_GRID: Record<SupplementPriceKey, Record<PizzaSizeId, number>>;
export declare const SUPPLEMENT_PRICE_KEY_BY_SLUG: Record<string, SupplementPriceKey>;
export declare function priceForPizzaSize(basePrice31: number, sizeId: PizzaSizeId): number;
export declare function priceForSupplement(key: SupplementPriceKey, sizeId: PizzaSizeId): number;
export declare function pizzaSizeLabel(sizeId: PizzaSizeId): string;
//# sourceMappingURL=pizza-sizes.d.ts.map