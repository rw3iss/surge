/**
 * Shop service aggregate — re-exports the sub-services so `sdk/shop.ts`
 * (and `cms.shop`) has a single import surface. Catalog Phase 2 covers
 * products / variants / catalog; later phases add reviews / orders /
 * checkout / settings.
 */
export * as products from './products';
export * as variants from './variants';
export * as catalog from './catalog';
