import { Component, Show, } from 'solid-js';
import { isShopifyActive, shopifyAdminUrl, } from '../../../services/shopifySource';

/**
 * Banner shown across the admin Shop pages while the Shopify plugin is enabled:
 * the internal shop is overridden and everything is managed in Shopify. Only
 * renders when Shopify is active, so callers can drop it in unconditionally.
 */
const ShopifyManagedBanner: Component<{ note?: string; }> = (props,) => (
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
);

export default ShopifyManagedBanner;
