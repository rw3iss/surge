/**
 * Wire DTOs for the shop feature module (mounted at /api/v1/shop,
 * `requireFeature('shop')`). Entity types live in `../../types/shop` and
 * are referenced — never re-declared — by the request/response DTOs.
 *
 * Phase 2 fills the CATALOG surface: products (+ nested options/variants/
 * media/taxonomy), categories, collections, tags. Later phases add
 * reviews (3), checkout + orders (4), and shop settings (5).
 *
 * Naming follows the barrel convention (`../index.ts`): `Shop<Action>`
 * Query / Body / Params for requests, `Shop<Action>Response` for the
 * `data` payload; list responses type `data` as the element array with
 * pagination on `ApiResponse.meta`.
 */

import type {
    ShopCategory,
    ShopCollection,
    ShopProduct,
    ShopProductDetail,
    ShopProductType,
} from '../../types/shop';
import type { BulkActionResult, } from './_shared';

// ─── Nested write inputs (product structure) ──────────────────────

/** An option + its ordered values, as sent in a product write. */
export interface ShopOptionInput {
    name: string;
    position?: number;
    values: { value: string; position?: number; }[];
}

/** A variant, as sent in a product write. */
export interface ShopVariantInput {
    sku?: string | null;
    priceCents: number;
    compareAtPriceCents?: number | null;
    inventoryQty?: number;
    weightGrams?: number | null;
    requiresShipping?: boolean;
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
    imageId?: string | null;
    position?: number;
    isDefault?: boolean;
}

/** A product-media assignment, as sent in a product write. */
export interface ShopMediaInput {
    mediaId: string;
    variantId?: string | null;
    position?: number;
    kind?: 'image' | 'video';
}

// ─── GET /shop/products ───────────────────────────────────────────

/** Query accepted by GET /shop/products. */
export interface ShopProductListQuery {
    /** public/admin: substring match on title/description */
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    /** admin trigger: 'true' switches to the all-statuses view */
    all?: string;
    /** admin filter (presence also triggers the admin view) */
    status?: string;
    page?: number;
    limit?: number;
}

/** GET /shop/products — active products (public) or any-status (admin).
 *  Page meta rides the ApiResponse envelope. */
export type ShopProductListResponse = ShopProduct[];

// ─── GET /shop/products/slug/:slug ────────────────────────────────

/** Params for GET /shop/products/slug/:slug. */
export interface ShopProductBySlugParams {
    slug: string;
}

/** Query accepted by GET /shop/products/slug/:slug. */
export interface ShopProductBySlugQuery {
    /** admin-preview: 'admin' returns any-status detail when authorized */
    preview?: string;
}

/** GET /shop/products/slug/:slug — full nested detail. */
export type ShopProductBySlugResponse = ShopProductDetail;

// ─── GET /shop/products/:id (admin) ───────────────────────────────

/** Params for the product-by-id family of routes. */
export interface ShopProductIdParams {
    id: string;
}

/** GET /shop/products/:id — full nested detail at any status. */
export type ShopProductByIdResponse = ShopProductDetail;

// ─── POST /shop/products ──────────────────────────────────────────

/** Body for POST /shop/products (create + structure). */
export interface ShopProductCreateBody {
    title: string;
    slug: string;
    description?: string | null;
    type?: ShopProductType;
    status?: 'draft' | 'active' | 'archived';
    metaTitle?: string | null;
    metaDescription?: string | null;
    options?: ShopOptionInput[];
    variants?: ShopVariantInput[];
    media?: ShopMediaInput[];
    categoryIds?: string[];
    collectionIds?: string[];
    tags?: string[];
}

/** POST /shop/products (201) — the created product, full detail. */
export type ShopProductCreateResponse = ShopProductDetail;

// ─── PUT /shop/products/:id ───────────────────────────────────────

/** Body for PUT /shop/products/:id — partial create body. */
export type ShopProductUpdateBody = Partial<ShopProductCreateBody>;

/** PUT /shop/products/:id — the updated product, full detail. */
export type ShopProductUpdateResponse = ShopProductDetail;

// ─── DELETE /shop/products/:id ────────────────────────────────────

/** DELETE /shop/products/:id — confirmation message. */
export interface ShopProductDeleteResponse {
    message: string;
}

// ─── POST /shop/products/bulk ─────────────────────────────────────

/** Body for POST /shop/products/bulk (unified bulk runner). */
export interface ShopProductBulkBody {
    ids: string[];
    action: 'delete' | 'status';
    /** status value when action='status' */
    value?: string;
}

/** POST /shop/products/bulk — count + action performed. */
export type ShopProductBulkResponse = BulkActionResult;

// ─── Categories ───────────────────────────────────────────────────

/** GET /shop/categories — flat list (tree assembled via parentId). */
export type ShopCategoryListResponse = ShopCategory[];

/** Params for GET /shop/categories/slug/:slug. */
export interface ShopCategoryBySlugParams {
    slug: string;
}

/** GET /shop/categories/slug/:slug — the category plus its active products. */
export interface ShopCategoryBySlugResponse {
    category: ShopCategory;
    products: ShopProduct[];
}

/** Params for the category-by-id family. */
export interface ShopCategoryIdParams {
    id: string;
}

/** Body for POST /shop/categories (create). */
export interface ShopCategoryCreateBody {
    name: string;
    slug: string;
    parentId?: string | null;
    description?: string | null;
    imageId?: string | null;
    position?: number;
}

/** POST /shop/categories (201) — the created category. */
export type ShopCategoryCreateResponse = ShopCategory;

/** Body for PUT /shop/categories/:id — partial create body. */
export type ShopCategoryUpdateBody = Partial<ShopCategoryCreateBody>;

/** PUT /shop/categories/:id — the updated category. */
export type ShopCategoryUpdateResponse = ShopCategory;

/** DELETE /shop/categories/:id — confirmation message. */
export interface ShopCategoryDeleteResponse {
    message: string;
}

// ─── Collections ──────────────────────────────────────────────────

/** GET /shop/collections — published (public) or all (admin via all=true). */
export type ShopCollectionListResponse = ShopCollection[];

/** Query accepted by GET /shop/collections. */
export interface ShopCollectionListQuery {
    /** admin trigger: 'true' returns unpublished collections too */
    all?: string;
}

/** Params for GET /shop/collections/slug/:slug. */
export interface ShopCollectionBySlugParams {
    slug: string;
}

/** GET /shop/collections/slug/:slug — the collection plus curated products. */
export interface ShopCollectionBySlugResponse {
    collection: ShopCollection;
    products: ShopProduct[];
}

/** Params for the collection-by-id family. */
export interface ShopCollectionIdParams {
    id: string;
}

/** Body for POST /shop/collections (create). `productIds` sets membership. */
export interface ShopCollectionCreateBody {
    title: string;
    slug: string;
    description?: string | null;
    imageId?: string | null;
    position?: number;
    isPublished?: boolean;
    productIds?: string[];
}

/** POST /shop/collections (201) — the created collection. */
export type ShopCollectionCreateResponse = ShopCollection;

/** Body for PUT /shop/collections/:id — partial create body. */
export type ShopCollectionUpdateBody = Partial<ShopCollectionCreateBody>;

/** PUT /shop/collections/:id — the updated collection. */
export type ShopCollectionUpdateResponse = ShopCollection;

/** DELETE /shop/collections/:id — confirmation message. */
export interface ShopCollectionDeleteResponse {
    message: string;
}

// ─── Tags ─────────────────────────────────────────────────────────

/** GET /shop/tags — distinct tag list. */
export type ShopTagListResponse = string[];
