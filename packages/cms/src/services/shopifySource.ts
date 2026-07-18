/**
 * Shopify override seam. When the `shopify` plugin is enabled it OVERRIDES the
 * built-in Shop: the storefront + admin shop pages read from these helpers (which
 * proxy the plugin's server-side Shopify actions) instead of `cms.shop.*`. All
 * Shopify API access stays server-side (secret tokens); this is just the typed
 * client wrapper. Shapes are already adapted to the CMS `Shop*` types by the
 * plugin's server.js, so the existing Solid components render unchanged.
 */
import type { ShopCollection, ShopProduct, ShopProductDetail, } from '@sitesurge/types';
import { cms, } from './cmsClient';
import { isPluginEnabled, pluginConfig, } from '../stores/plugins';

/** True when the Shopify plugin is enabled (and thus overriding the shop). */
export const isShopifyActive = (): boolean => isPluginEnabled('shopify',);

/** The connected shop domain (public config), for "Open in Shopify" links. */
export const shopifyDomain = (): string => String(pluginConfig('shopify',).shopDomain || '',);

/** Base URL of the connected Shopify admin (empty when not configured). */
export const shopifyAdminUrl = (): string => {
    const d = shopifyDomain();
    return d ? `https://${d}/admin` : '';
};

const call = <T,>(action: string, payload?: Record<string, unknown>,): Promise<T> =>
    cms.plugins.action<T>('shopify', action, payload,);

export interface ShopifyCartLine {
    id: string;
    variantId: string;
    title: string;
    quantity: number;
    priceCents: number;
    image?: string | null;
}

export interface ShopifyCart {
    id: string;
    checkoutUrl: string;
    currency: string;
    subtotalCents: number;
    totalCents: number;
    lines: ShopifyCartLine[];
}

export interface ShopifyOrder {
    id: string;
    name: string;
    createdAt: string;
    email?: string | null;
    customerName?: string | null;
    financialStatus?: string | null;
    fulfillmentStatus?: string | null;
    totalCents: number;
    currency: string;
}

export interface ShopifyStats {
    ok: boolean;
    productCount?: number | null;
    orderCount?: number | null;
    recentSalesCents?: number;
    currency?: string;
    error?: string;
}

export const shopifySource = {
    listProducts: (p: { limit?: number; cursor?: string; search?: string; },) =>
        call<{ ok: boolean; products: ShopProduct[]; pageInfo: { hasNextPage: boolean; endCursor?: string; }; error?: string; }>('listProducts', p,),
    getProduct: (handle: string,) =>
        call<{ ok: boolean; product?: ShopProductDetail; error?: string; }>('getProduct', { handle, },),
    listCollections: () =>
        call<{ ok: boolean; collections: ShopCollection[]; error?: string; }>('listCollections', {},),
    getCollection: (handle: string,) =>
        call<{ ok: boolean; collection?: ShopCollection; products: ShopProduct[]; error?: string; }>('getCollection', { handle, },),
    cartCreate: (lines: Array<{ merchandiseId: string; quantity: number; }>,) =>
        call<{ ok: boolean; cart?: ShopifyCart; error?: string; }>('cartCreate', { lines, },),
    listOrders: (first = 20,) =>
        call<{ ok: boolean; orders: ShopifyOrder[]; error?: string; }>('listOrders', { first, },),
    shopStats: () => call<ShopifyStats>('shopStats', {},),
};
