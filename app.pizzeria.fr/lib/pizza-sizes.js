"use strict";
/** Tailles pizza La Z — grilles tarifaires flyer (prix fixes par palier) */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPLEMENT_PRICE_KEY_BY_SLUG = exports.SUPPLEMENT_PRICE_GRID = exports.PIZZA_SIZES = void 0;
exports.priceForPizzaSize = priceForPizzaSize;
exports.priceForSupplement = priceForSupplement;
exports.pizzaSizeLabel = pizzaSizeLabel;
exports.PIZZA_SIZES = [
    { id: '31', label: '31 cm', seniorLabel: 'Sénior' },
    { id: '40', label: '40 cm', seniorLabel: 'Méga' },
    { id: '50', label: '50 cm', seniorLabel: 'Suprema' },
    { id: '60x40', label: 'Méga 60×40', seniorLabel: 'Supergéante' },
];
/** Grilles flyer — prix 31 / 40 / 50 / 60×40 cm */
const PIZZA_PRICE_GRID = {
    11: { '31': 11, '40': 18.5, '50': 25.5, '60x40': 28.5 },
    12: { '31': 12, '40': 19.5, '50': 26.5, '60x40': 29.5 },
    13.5: { '31': 13.5, '40': 20.5, '50': 27.5, '60x40': 34.5 },
    16.5: { '31': 16.5, '40': 24.5, '50': 30.5, '60x40': 38.5 },
};
exports.SUPPLEMENT_PRICE_GRID = {
    'meat-cheese': { '31': 2.5, '40': 3.5, '50': 4.5, '60x40': 5.5 },
    veg: { '31': 1, '40': 2, '50': 3, '60x40': 4 },
    cheezy: { '31': 3, '40': 4, '50': 5, '60x40': 6 },
    premium: { '31': 3, '40': 4, '50': 5, '60x40': 6 },
};
exports.SUPPLEMENT_PRICE_KEY_BY_SLUG = {
    'supplements-viande-fromage': 'meat-cheese',
    'supplements-legumes': 'veg',
    'supplements-pate-cheezy': 'cheezy',
    'supplements-magret-jambon-truffe-ou-serrano': 'premium',
};
function priceForPizzaSize(basePrice31, sizeId) {
    const grid = PIZZA_PRICE_GRID[basePrice31];
    if (grid)
        return grid[sizeId];
    // repli si prix catalogue atypique
    const tier = basePrice31 >= 16 ? 16.5 : basePrice31 >= 13.5 ? 13.5 : basePrice31 >= 12 ? 12 : 11;
    return PIZZA_PRICE_GRID[tier][sizeId];
}
function priceForSupplement(key, sizeId) {
    return exports.SUPPLEMENT_PRICE_GRID[key][sizeId];
}
function pizzaSizeLabel(sizeId) {
    return exports.PIZZA_SIZES.find((s) => s.id === sizeId)?.label ?? sizeId;
}
//# sourceMappingURL=pizza-sizes.js.map