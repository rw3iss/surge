'use strict';
/**
 * Shopify plugin — server hooks + backend actions. When enabled, the CMS Shop
 * feature is OVERRIDDEN: the storefront reads products/collections live from
 * Shopify and hands checkout off to Shopify's hosted checkout; the admin shows a
 * read-only dashboard over Shopify data. All Shopify API access is server-side
 * here (secret Storefront + Admin tokens, never sent to the browser). Actions are
 * invoked via POST /api/v1/plugins/shopify/action/:action and return a normalized
 * { ok, ... } / { ok:false, status, error } envelope — they never throw, so the
 * admin/storefront can surface a clear message and detect a misconfiguration.
 *
 * Shopify objects are ADAPTED into the CMS `Shop*` shapes (shared/types/shop.ts)
 * so the existing Solid components render unchanged.
 */
const DEFAULT_VERSION = '2024-10';

function cfg(ctx) {
    const c = ctx.config || {};
    const domain = String(c.shopDomain || '')
        .replace(/^https?:\/\//i, '')
        .replace(/\/.*$/, '')
        .trim();
    return {
        domain,
        storefrontToken: String(c.storefrontToken || ''),
        adminToken: String(c.adminToken || ''),
        version: String(c.apiVersion || DEFAULT_VERSION).trim() || DEFAULT_VERSION,
    };
}

/** POST a GraphQL query to a Shopify endpoint; normalized envelope, never throws. */
async function gqlPost(ctx, url, token, headerName, query, variables) {
    let res;
    try {
        res = await ctx.http(url, {
            method: 'POST',
            headers: { [headerName]: token, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ query, variables: variables || {} }),
        });
    } catch (e) {
        return { ok: false, status: 0, error: `Network error reaching Shopify: ${e && e.message}` };
    }
    let json = null;
    try { json = await res.json(); } catch (_) { /* non-JSON */ }
    if (!res.ok) {
        const msg = (json && (json.errors && json.errors[0] && json.errors[0].message)) || res.statusText || `HTTP ${res.status}`;
        return { ok: false, status: res.status, error: msg, details: json };
    }
    if (json && json.errors && json.errors.length) {
        return { ok: false, status: 200, error: json.errors.map((e) => e.message).join('; '), details: json.errors };
    }
    return { ok: true, status: res.status, data: (json && json.data) || {} };
}

function storefront(ctx, query, variables) {
    const { domain, storefrontToken, version } = cfg(ctx);
    if (!domain || !storefrontToken) return Promise.resolve({ ok: false, status: 0, error: 'Shopify shop domain / storefront token not configured' });
    return gqlPost(ctx, `https://${domain}/api/${version}/graphql.json`, storefrontToken, 'X-Shopify-Storefront-Access-Token', query, variables);
}

function admin(ctx, query, variables) {
    const { domain, adminToken, version } = cfg(ctx);
    if (!domain || !adminToken) return Promise.resolve({ ok: false, status: 0, error: 'Shopify admin token not configured' });
    return gqlPost(ctx, `https://${domain}/admin/api/${version}/graphql.json`, adminToken, 'X-Shopify-Access-Token', query, variables);
}

// ── adapters: Shopify → CMS Shop* shapes ────────────────────────────────────────
function money(m) { return m && m.amount != null ? Math.round(parseFloat(m.amount) * 100) : 0; }

/** List-shape product (grid card). */
function adaptProduct(node) {
    if (!node) return null;
    return {
        id: node.id, title: node.title, slug: node.handle,
        description: null, type: 'physical', status: 'active',
        ratingAvg: 0, ratingCount: 0, createdAt: '', updatedAt: '',
        fromPriceCents: node.priceRange ? money(node.priceRange.minVariantPrice) : undefined,
        primaryImageUrl: (node.featuredImage && node.featuredImage.url) || null,
    };
}

/** Full product detail (options + values, variants, media). */
function adaptProductDetail(node) {
    if (!node) return null;
    const options = (node.options || []).map((o, i) => ({
        id: o.id || `opt-${i}`, productId: node.id, name: o.name, position: i, createdAt: '',
        values: (o.values || []).map((v, j) => ({ id: `${o.id || i}:${v}`, optionId: o.id || `opt-${i}`, value: v, position: j })),
    }));
    const optionNames = options.map((o) => o.name);
    const variants = ((node.variants && node.variants.nodes) || []).map((v, i) => {
        const byName = {};
        for (const so of v.selectedOptions || []) byName[so.name] = so.value;
        const qty = v.quantityAvailable != null ? v.quantityAvailable : (v.availableForSale ? 9999 : 0);
        return {
            id: v.id, productId: node.id, sku: v.sku || null,
            priceCents: money(v.price), compareAtPriceCents: v.compareAtPrice ? money(v.compareAtPrice) : null,
            inventoryQty: qty, weightGrams: null, requiresShipping: true,
            option1: optionNames[0] ? (byName[optionNames[0]] ?? null) : null,
            option2: optionNames[1] ? (byName[optionNames[1]] ?? null) : null,
            option3: optionNames[2] ? (byName[optionNames[2]] ?? null) : null,
            imageId: null, position: i, isDefault: i === 0, createdAt: '', updatedAt: '',
        };
    });
    const media = ((node.images && node.images.nodes) || []).map((img, i) => ({
        id: img.id || `img-${i}`, productId: node.id, mediaId: img.id || `img-${i}`, variantId: null,
        position: i, kind: 'image', createdAt: '',
        url: img.url, thumbnailUrl: img.url, alt: img.altText || null, mediaType: 'image',
    }));
    return {
        id: node.id, title: node.title, slug: node.handle,
        description: node.descriptionHtml || null, type: 'physical', status: 'active',
        metaTitle: node.title, metaDescription: null,
        ratingAvg: 0, ratingCount: 0, createdAt: '', updatedAt: '',
        fromPriceCents: node.priceRange ? money(node.priceRange.minVariantPrice) : undefined,
        primaryImageUrl: (node.featuredImage && node.featuredImage.url) || (media[0] && media[0].url) || null,
        options, variants, media, categoryIds: [], collectionIds: [], tags: node.tags || [],
    };
}

function adaptCollection(node, i) {
    if (!node) return null;
    return {
        id: node.id, title: node.title, slug: node.handle,
        description: node.descriptionHtml || null, imageId: null, position: i || 0,
        isPublished: true, createdAt: '', updatedAt: '',
    };
}

function adaptCart(cart) {
    if (!cart) return null;
    const lines = ((cart.lines && cart.lines.nodes) || []).map((n) => {
        const m = n.merchandise || {};
        const vTitle = m.title && m.title !== 'Default Title' ? ` — ${m.title}` : '';
        return {
            id: n.id, variantId: m.id,
            title: `${(m.product && m.product.title) || 'Item'}${vTitle}`,
            quantity: n.quantity, priceCents: money(m.price),
            image: (m.image && m.image.url) || null,
        };
    });
    return {
        id: cart.id, checkoutUrl: cart.checkoutUrl,
        currency: (cart.cost && cart.cost.subtotalAmount && cart.cost.subtotalAmount.currencyCode) || 'USD',
        subtotalCents: cart.cost ? money(cart.cost.subtotalAmount) : 0,
        totalCents: cart.cost ? money(cart.cost.totalAmount) : 0,
        lines,
    };
}

function adaptOrder(node) {
    if (!node) return null;
    const shop = node.totalPriceSet && node.totalPriceSet.shopMoney;
    return {
        id: node.id, name: node.name, createdAt: node.createdAt, email: node.email || null,
        customerName: (node.customer && node.customer.displayName) || null,
        financialStatus: node.displayFinancialStatus || null,
        fulfillmentStatus: node.displayFulfillmentStatus || null,
        totalCents: money(shop), currency: (shop && shop.currencyCode) || 'USD',
    };
}

// ── GraphQL documents ───────────────────────────────────────────────────────────
const PRODUCT_CARD_FIELDS = `id title handle featuredImage{ url } priceRange{ minVariantPrice{ amount currencyCode } }`;
const CART_FIELDS = `
  id checkoutUrl
  cost{ subtotalAmount{ amount currencyCode } totalAmount{ amount currencyCode } }
  lines(first:100){ nodes{ id quantity merchandise{ ... on ProductVariant{ id title image{ url } product{ title } price{ amount currencyCode } } } } }`;

const Q_LIST_PRODUCTS = `query($n:Int!,$cursor:String,$q:String){ products(first:$n, after:$cursor, query:$q){ nodes{ ${PRODUCT_CARD_FIELDS} } pageInfo{ hasNextPage endCursor } } }`;
const Q_PRODUCT = `query($handle:String!){ productByHandle(handle:$handle){
  id title handle descriptionHtml tags featuredImage{ url }
  priceRange{ minVariantPrice{ amount currencyCode } }
  options{ id name values }
  images(first:20){ nodes{ id url altText } }
  variants(first:100){ nodes{ id title sku availableForSale quantityAvailable price{ amount currencyCode } compareAtPrice{ amount currencyCode } selectedOptions{ name value } image{ url altText } } }
} }`;
const Q_LIST_COLLECTIONS = `query($n:Int!){ collections(first:$n){ nodes{ id title handle descriptionHtml } } }`;
const Q_COLLECTION = `query($handle:String!,$n:Int!){ collectionByHandle(handle:$handle){ id title handle descriptionHtml products(first:$n){ nodes{ ${PRODUCT_CARD_FIELDS} } } } }`;
const Q_CART = `query($id:ID!){ cart(id:$id){ ${CART_FIELDS} } }`;
const M_CART_CREATE = `mutation($lines:[CartLineInput!]!){ cartCreate(input:{ lines:$lines }){ cart{ ${CART_FIELDS} } userErrors{ field message } } }`;
const M_CART_ADD = `mutation($cartId:ID!,$lines:[CartLineInput!]!){ cartLinesAdd(cartId:$cartId, lines:$lines){ cart{ ${CART_FIELDS} } userErrors{ field message } } }`;
const M_CART_UPDATE = `mutation($cartId:ID!,$lines:[CartLineUpdateInput!]!){ cartLinesUpdate(cartId:$cartId, lines:$lines){ cart{ ${CART_FIELDS} } userErrors{ field message } } }`;
const M_CART_REMOVE = `mutation($cartId:ID!,$lineIds:[ID!]!){ cartLinesRemove(cartId:$cartId, lineIds:$lineIds){ cart{ ${CART_FIELDS} } userErrors{ field message } } }`;
const Q_ORDERS = `query($n:Int!){ orders(first:$n, sortKey:CREATED_AT, reverse:true){ nodes{ id name createdAt email displayFinancialStatus displayFulfillmentStatus customer{ displayName } totalPriceSet{ shopMoney{ amount currencyCode } } } } }`;
const Q_STATS = `query{ productsCount{ count } ordersCount{ count } orders(first:50, sortKey:CREATED_AT, reverse:true){ nodes{ displayFinancialStatus totalPriceSet{ shopMoney{ amount currencyCode } } } } }`;

function firstUserError(payloadKey, data) {
    const p = data && data[payloadKey];
    const errs = p && p.userErrors;
    if (errs && errs.length) return errs[0].message;
    return null;
}

module.exports = {
    async install(ctx) { ctx.logger.info('Shopify plugin installed.'); },
    async onEnable(ctx) { ctx.logger.info('Shopify enabled — overriding the internal Shop.'); },
    async onDisable(ctx) { ctx.logger.info('Shopify disabled — internal Shop restored.'); },
    async onLoad() { /* no server runtime; overrides are request-time via actions */ },
    async update(ctx) {
        return { fromVersion: ctx.installedVersion || ctx.version, toVersion: ctx.version, migrated: false, notes: 'No migration.' };
    },

    validateConfig(config) {
        const errors = {};
        if (config.shopDomain !== undefined && !String(config.shopDomain || '').trim()) errors.shopDomain = 'Shop domain is required';
        if (config.storefrontToken !== undefined && !String(config.storefrontToken || '').trim()) errors.storefrontToken = 'Storefront token is required';
        if (config.apiVersion && !/^\d{4}-\d{2}$/.test(String(config.apiVersion))) errors.apiVersion = 'Use YYYY-MM (e.g. 2024-10)';
        return { ok: Object.keys(errors).length === 0, errors };
    },

    actions: {
        async testConnection(ctx) {
            const r = await storefront(ctx, `query{ shop{ name } }`);
            if (!r.ok) return { ok: false, status: r.status, error: r.error };
            let adminOk = false;
            const { adminToken } = cfg(ctx);
            if (adminToken) {
                const a = await admin(ctx, `query{ shop{ name } }`);
                adminOk = !!a.ok;
            }
            return { ok: true, shopName: (r.data.shop && r.data.shop.name) || null, adminOk, adminConfigured: !!adminToken };
        },

        async listProducts(ctx, payload) {
            const n = Math.min(Number((payload && payload.limit) || 24), 100);
            const r = await storefront(ctx, Q_LIST_PRODUCTS, { n, cursor: (payload && payload.cursor) || null, q: (payload && payload.search) || null });
            if (!r.ok) return r;
            const conn = r.data.products || { nodes: [], pageInfo: {} };
            return { ok: true, products: (conn.nodes || []).map(adaptProduct).filter(Boolean), pageInfo: conn.pageInfo || { hasNextPage: false } };
        },

        async getProduct(ctx, payload) {
            const handle = payload && payload.handle;
            if (!handle) return { ok: false, status: 400, error: 'handle required' };
            const r = await storefront(ctx, Q_PRODUCT, { handle: String(handle) });
            if (!r.ok) return r;
            if (!r.data.productByHandle) return { ok: false, status: 404, error: 'Product not found' };
            return { ok: true, product: adaptProductDetail(r.data.productByHandle) };
        },

        async listCollections(ctx, payload) {
            const n = Math.min(Number((payload && payload.limit) || 50), 100);
            const r = await storefront(ctx, Q_LIST_COLLECTIONS, { n });
            if (!r.ok) return r;
            return { ok: true, collections: ((r.data.collections && r.data.collections.nodes) || []).map(adaptCollection).filter(Boolean) };
        },

        async getCollection(ctx, payload) {
            const handle = payload && payload.handle;
            if (!handle) return { ok: false, status: 400, error: 'handle required' };
            const n = Math.min(Number((payload && payload.limit) || 48), 100);
            const r = await storefront(ctx, Q_COLLECTION, { handle: String(handle), n });
            if (!r.ok) return r;
            const c = r.data.collectionByHandle;
            if (!c) return { ok: false, status: 404, error: 'Collection not found' };
            return {
                ok: true,
                collection: adaptCollection(c, 0),
                products: ((c.products && c.products.nodes) || []).map(adaptProduct).filter(Boolean),
            };
        },

        async cartCreate(ctx, payload) {
            const lines = (payload && payload.lines) || [];
            if (!lines.length) return { ok: false, status: 400, error: 'no line items' };
            const r = await storefront(ctx, M_CART_CREATE, { lines });
            if (!r.ok) return r;
            const err = firstUserError('cartCreate', r.data);
            if (err) return { ok: false, status: 422, error: err };
            return { ok: true, cart: adaptCart(r.data.cartCreate.cart) };
        },

        async cartGet(ctx, payload) {
            const id = payload && payload.cartId;
            if (!id) return { ok: false, status: 400, error: 'cartId required' };
            const r = await storefront(ctx, Q_CART, { id: String(id) });
            if (!r.ok) return r;
            if (!r.data.cart) return { ok: false, status: 404, error: 'Cart not found or expired' };
            return { ok: true, cart: adaptCart(r.data.cart) };
        },

        async cartLinesAdd(ctx, payload) {
            const { cartId, lines } = payload || {};
            if (!cartId || !lines) return { ok: false, status: 400, error: 'cartId + lines required' };
            const r = await storefront(ctx, M_CART_ADD, { cartId, lines });
            if (!r.ok) return r;
            const err = firstUserError('cartLinesAdd', r.data);
            if (err) return { ok: false, status: 422, error: err };
            return { ok: true, cart: adaptCart(r.data.cartLinesAdd.cart) };
        },

        async cartLinesUpdate(ctx, payload) {
            const { cartId, lines } = payload || {};
            if (!cartId || !lines) return { ok: false, status: 400, error: 'cartId + lines required' };
            const r = await storefront(ctx, M_CART_UPDATE, { cartId, lines });
            if (!r.ok) return r;
            const err = firstUserError('cartLinesUpdate', r.data);
            if (err) return { ok: false, status: 422, error: err };
            return { ok: true, cart: adaptCart(r.data.cartLinesUpdate.cart) };
        },

        async cartLinesRemove(ctx, payload) {
            const { cartId, lineIds } = payload || {};
            if (!cartId || !lineIds) return { ok: false, status: 400, error: 'cartId + lineIds required' };
            const r = await storefront(ctx, M_CART_REMOVE, { cartId, lineIds });
            if (!r.ok) return r;
            const err = firstUserError('cartLinesRemove', r.data);
            if (err) return { ok: false, status: 422, error: err };
            return { ok: true, cart: adaptCart(r.data.cartLinesRemove.cart) };
        },

        async listOrders(ctx, payload) {
            const n = Math.min(Number((payload && payload.first) || 20), 50);
            const r = await admin(ctx, Q_ORDERS, { n });
            if (!r.ok) return r;
            return { ok: true, orders: ((r.data.orders && r.data.orders.nodes) || []).map(adaptOrder).filter(Boolean) };
        },

        async shopStats(ctx) {
            const r = await admin(ctx, Q_STATS);
            if (!r.ok) return r;
            const nodes = (r.data.orders && r.data.orders.nodes) || [];
            let recentSalesCents = 0;
            let currency = 'USD';
            for (const o of nodes) {
                const s = o.totalPriceSet && o.totalPriceSet.shopMoney;
                if (o.displayFinancialStatus === 'PAID' || o.displayFinancialStatus === 'PARTIALLY_REFUNDED') recentSalesCents += money(s);
                if (s && s.currencyCode) currency = s.currencyCode;
            }
            return {
                ok: true,
                productCount: (r.data.productsCount && r.data.productsCount.count) ?? null,
                orderCount: (r.data.ordersCount && r.data.ordersCount.count) ?? null,
                recentSalesCents, currency,
            };
        },
    },
};
