import { z, } from 'zod';
import type {
    AssertCompatible,
    ShopCategoryCreateBody,
    ShopCollectionCreateBody,
    ShopCollectionListQuery,
    ShopProductBySlugQuery,
    ShopProductCreateBody,
    ShopProductListQuery,
} from '@rw/cms-shared';
import { defineRoute, reply, } from '../api/defineRoute';
import { isAdminRole, } from '../api/roles';
import { NotFoundError, } from '../core/errors';
import * as catalog from '../services/shop/catalog';
import * as products from '../services/shop/products';

// ─── Schemas ──────────────────────────────────────────────────────

const optionInputSchema = z.object({
    name: z.string().min(1,).max(100,),
    position: z.number().int().optional(),
    values: z.array(z.object({
        value: z.string().min(1,).max(255,),
        position: z.number().int().optional(),
    },),),
},);

const variantInputSchema = z.object({
    sku: z.string().max(100,).nullish(),
    priceCents: z.number().int().min(0,),
    compareAtPriceCents: z.number().int().min(0,).nullish(),
    inventoryQty: z.number().int().optional(),
    weightGrams: z.number().int().nullish(),
    requiresShipping: z.boolean().optional(),
    option1: z.string().max(255,).nullish(),
    option2: z.string().max(255,).nullish(),
    option3: z.string().max(255,).nullish(),
    imageId: z.string().nullish(),
    position: z.number().int().optional(),
    isDefault: z.boolean().optional(),
},);

const mediaInputSchema = z.object({
    mediaId: z.string(),
    variantId: z.string().nullish(),
    position: z.number().int().optional(),
    kind: z.enum(['image', 'video',],).optional(),
},);

const productSchema = z.object({
    title: z.string().min(1,).max(255,),
    slug: z.string().min(1,).max(255,).regex(/^[a-z0-9-]+$/,),
    description: z.string().nullish(),
    type: z.enum(['physical', 'digital',],).optional(),
    status: z.enum(['draft', 'active', 'archived',],).optional(),
    metaTitle: z.string().max(255,).nullish(),
    metaDescription: z.string().nullish(),
    options: z.array(optionInputSchema,).optional(),
    variants: z.array(variantInputSchema,).optional(),
    media: z.array(mediaInputSchema,).optional(),
    categoryIds: z.array(z.string(),).optional(),
    collectionIds: z.array(z.string(),).optional(),
    tags: z.array(z.string(),).optional(),
},) satisfies z.ZodType<ShopProductCreateBody>;

const productListQuery = z.object({
    search: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.string().optional(),
    all: z.string().optional(),
    status: z.string().optional(),
    page: z.coerce.number().int().min(1,).default(1,),
    limit: z.coerce.number().int().min(1,).max(100,).default(20,),
},);

const productSlugParams = z.object({ slug: z.string(), },);
const productSlugQuery = z.object({ preview: z.string().optional(), },);
const idParams = z.object({ id: z.string(), },);
const slugParams = z.object({ slug: z.string(), },);

const categorySchema = z.object({
    name: z.string().min(1,).max(255,),
    slug: z.string().min(1,).max(255,).regex(/^[a-z0-9-]+$/,),
    parentId: z.string().nullish(),
    description: z.string().nullish(),
    imageId: z.string().nullish(),
    position: z.number().int().optional(),
},) satisfies z.ZodType<ShopCategoryCreateBody>;

const collectionSchema = z.object({
    title: z.string().min(1,).max(255,),
    slug: z.string().min(1,).max(255,).regex(/^[a-z0-9-]+$/,),
    description: z.string().nullish(),
    imageId: z.string().nullish(),
    position: z.number().int().optional(),
    isPublished: z.boolean().optional(),
    productIds: z.array(z.string(),).optional(),
},) satisfies z.ZodType<ShopCollectionCreateBody>;

const collectionListQuery = z.object({ all: z.string().optional(), },);

// Query schemas coerce (string → number), so assert z.infer compatibility.
type _AssertProductListQuery = AssertCompatible<z.infer<typeof productListQuery>, ShopProductListQuery>;
type _AssertProductSlugQuery = AssertCompatible<z.infer<typeof productSlugQuery>, ShopProductBySlugQuery>;
type _AssertCollectionListQuery = AssertCompatible<z.infer<typeof collectionListQuery>, ShopCollectionListQuery>;

// ─── Routes ───────────────────────────────────────────────────────
// Literal paths (/products/slug/:slug, /products/bulk, /categories/*,
// /collections/*, /tags) declared before the /products/:id catch-all.
// The whole module 404s when the `shop` feature is disabled (guard
// applied at the registerModule mount).

export const shopRoutes = [

    // ── Products ──

    // List products. Public active-only array by default; admins passing
    // all=true (or status) get the paginated all-statuses list.
    defineRoute({
        method: 'get', path: '/products', auth: 'optional',
        summary: 'List products. Public active-only by default; admins passing all=true/status get the paginated admin list.',
        input: { query: productListQuery, },
        handler: async ({ user, apiKey, query, },) => {
            const isAdmin = isAdminRole(user?.role,) || Boolean(apiKey,);

            if (isAdmin && (query.all === 'true' || query.status !== undefined)) {
                const result = await products.list(
                    { status: query.status, search: query.search, sortBy: query.sortBy, sortOrder: query.sortOrder, },
                    { page: query.page, limit: query.limit, },
                );
                return reply(result.data, { meta: result.meta, },);
            }

            // Anonymous / non-admin → active-only, cache-safe.
            const result = await products.listPublicCached(
                { search: query.search, sortBy: query.sortBy, sortOrder: query.sortOrder, },
                { page: query.page, limit: query.limit, },
            );
            return reply(result.data, { meta: result.meta, },);
        },
    },),

    // Public product by slug (active-only, cached). Admins may pass
    // preview=admin to get the any-status detail.
    defineRoute({
        method: 'get', path: '/products/slug/:slug', auth: 'optional',
        summary: 'Fetch a product by slug with full nested detail. Public active-only; admins can preview=admin for any status.',
        input: { params: productSlugParams, query: productSlugQuery, },
        handler: async ({ params, query, user, apiKey, },) => {
            const isAdmin = isAdminRole(user?.role,) || Boolean(apiKey,);
            if (isAdmin && query.preview === 'admin') {
                const preview = await products.getBySlugAnyStatus(params.slug,);
                if (!preview) throw new NotFoundError('Product',);
                return preview;
            }
            const product = await products.getPublicBySlugCached(params.slug,);
            if (!product) throw new NotFoundError('Product',);
            return product;
        },
    },),

    // Bulk actions (admin).
    defineRoute({
        method: 'post', path: '/products/bulk', auth: 'admin',
        summary: 'Bulk status change / delete products by id list.',
        handler: ({ body, },) => products.bulk(body,),
    },),

    // Fetch product by id (admin, any status, full detail).
    defineRoute({
        method: 'get', path: '/products/:id', auth: 'admin',
        summary: 'Fetch a product by id with full nested detail (any status).',
        input: { params: idParams, },
        handler: async ({ params, },) => {
            const product = await products.getDetailById(params.id,);
            if (!product) throw new NotFoundError('Product',);
            return product;
        },
    },),

    // Create product (admin) + structure.
    defineRoute({
        method: 'post', path: '/products', auth: 'admin',
        summary: 'Create a product with its options/variants/media/taxonomy.',
        input: { body: productSchema, },
        handler: async ({ body, audit, },) => {
            const product = await products.create(body, audit(),);
            return reply(product, { status: 201, },);
        },
    },),

    // Update product (admin) + structure.
    defineRoute({
        method: 'put', path: '/products/:id', auth: 'admin',
        summary: 'Update a product and (when supplied) its structure/taxonomy.',
        input: { params: idParams, body: productSchema.partial(), },
        handler: ({ params, body, audit, },) => products.update(params.id, body, audit(),),
    },),

    // Delete product (admin).
    defineRoute({
        method: 'delete', path: '/products/:id', auth: 'admin',
        summary: 'Delete a product.',
        input: { params: idParams, },
        handler: async ({ params, audit, },) => {
            await products.remove(params.id, audit(),);
            return { message: 'Product deleted', };
        },
    },),

    // ── Categories ──

    defineRoute({
        method: 'get', path: '/categories', auth: 'public',
        summary: 'List all categories (flat; tree via parentId).',
        handler: () => catalog.listCategoriesCached(),
    },),

    defineRoute({
        method: 'get', path: '/categories/slug/:slug', auth: 'public',
        summary: 'Fetch a category by slug with its active products.',
        input: { params: slugParams, },
        handler: async ({ params, },) => {
            const category = await catalog.getCategoryBySlug(params.slug,);
            if (!category) throw new NotFoundError('Category',);
            const productsInCat = await catalog.productsInCategory(category.id,);
            return { category, products: productsInCat, };
        },
    },),

    defineRoute({
        method: 'post', path: '/categories', auth: 'admin',
        summary: 'Create a category.',
        input: { body: categorySchema, },
        handler: async ({ body, audit, },) => {
            const category = await catalog.createCategory(body, audit(),);
            return reply(category, { status: 201, },);
        },
    },),

    defineRoute({
        method: 'put', path: '/categories/:id', auth: 'admin',
        summary: 'Update a category.',
        input: { params: idParams, body: categorySchema.partial(), },
        handler: ({ params, body, audit, },) => catalog.updateCategory(params.id, body, audit(),),
    },),

    defineRoute({
        method: 'delete', path: '/categories/:id', auth: 'admin',
        summary: 'Delete a category.',
        input: { params: idParams, },
        handler: async ({ params, audit, },) => {
            await catalog.removeCategory(params.id, audit(),);
            return { message: 'Category deleted', };
        },
    },),

    // ── Collections ──

    defineRoute({
        method: 'get', path: '/collections', auth: 'optional',
        summary: 'List collections. Public published-only; admins passing all=true get every collection.',
        input: { query: collectionListQuery, },
        handler: ({ query, user, apiKey, },) => {
            const isAdmin = isAdminRole(user?.role,) || Boolean(apiKey,);
            if (isAdmin && query.all === 'true') {
                return catalog.listCollectionsAdmin();
            }
            return catalog.listCollectionsPublicCached();
        },
    },),

    defineRoute({
        method: 'get', path: '/collections/slug/:slug', auth: 'public',
        summary: 'Fetch a collection by slug with its curated active products.',
        input: { params: slugParams, },
        handler: async ({ params, },) => {
            const collection = await catalog.getCollectionBySlug(params.slug,);
            if (!collection) throw new NotFoundError('Collection',);
            const productsInCol = await catalog.productsInCollection(collection.id,);
            return { collection, products: productsInCol, };
        },
    },),

    defineRoute({
        method: 'post', path: '/collections', auth: 'admin',
        summary: 'Create a collection (productIds set membership).',
        input: { body: collectionSchema, },
        handler: async ({ body, audit, },) => {
            const { productIds, ...fields } = body;
            const collection = await catalog.createCollection(fields, productIds, audit(),);
            return reply(collection, { status: 201, },);
        },
    },),

    defineRoute({
        method: 'put', path: '/collections/:id', auth: 'admin',
        summary: 'Update a collection (productIds reset membership).',
        input: { params: idParams, body: collectionSchema.partial(), },
        handler: ({ params, body, audit, },) => {
            const { productIds, ...fields } = body;
            return catalog.updateCollection(params.id, fields, productIds, audit(),);
        },
    },),

    defineRoute({
        method: 'delete', path: '/collections/:id', auth: 'admin',
        summary: 'Delete a collection.',
        input: { params: idParams, },
        handler: async ({ params, audit, },) => {
            await catalog.removeCollection(params.id, audit(),);
            return { message: 'Collection deleted', };
        },
    },),

    // ── Tags ──

    defineRoute({
        method: 'get', path: '/tags', auth: 'public',
        summary: 'Distinct product tag list.',
        handler: () => catalog.listTagsCached(),
    },),
];
