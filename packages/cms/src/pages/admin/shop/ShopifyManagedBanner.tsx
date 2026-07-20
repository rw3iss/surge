import { Component, Show, } from 'solid-js';
import { isShopifyActive, isShopifyMisconfigured, shopifyAdminUrl, } from '../../../services/shopifySource';

/**
 * Banner shown across the admin Shop pages. Two states:
 *  - Shopify active (configured) → the built-in shop is overridden by Shopify.
 *  - Shopify enabled but NOT configured → a warning: the built-in shop is
 *    serving instead, and the plugin needs a shop domain + Storefront token
 *    (or should be disabled). Prevents the silent "blank shop" confusion.
 * Renders nothing when Shopify is off. Safe to drop in unconditionally.
 */
const ShopifyManagedBanner: Component<{ note?: string; }> = (props,) => (
    <>
        <Show when={isShopifyActive()}>
            <div class="shopify-banner">
                <span class="shopify-banner__icon" aria-hidden="true">🛍</span>
                <div class="shopify-banner__body">
                    <strong>Shopify is managing your store.</strong>{' '}
                    {props.note
                        || 'Products, orders, and checkout are served from your connected Shopify store. The internal shop is overridden while this plugin is enabled.'}
                </div>
                <Show when={shopifyAdminUrl()}>
                    <a href={shopifyAdminUrl()} target="_blank" rel="noopener" class="btn btn--secondary btn--small">
                        Open Shopify admin ↗
                    </a>
                </Show>
            </div>
        </Show>

        <Show when={isShopifyMisconfigured()}>
            <div class="shopify-banner shopify-banner--warning">
                <span class="shopify-banner__icon" aria-hidden="true">⚠️</span>
                <div class="shopify-banner__body">
                    <strong>The Shopify plugin is enabled but not configured.</strong>{' '}
                    Your built-in shop is serving in the meantime. Add a shop domain + Storefront API
                    token in <a href="/admin/plugins/shopify">Plugins → Shopify</a>, or disable the
                    plugin to keep using the built-in shop.
                </div>
            </div>
        </Show>
    </>
);

export default ShopifyManagedBanner;
