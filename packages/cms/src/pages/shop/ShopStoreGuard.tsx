import { createResource, ParentComponent, Show, } from 'solid-js';
import { isFeatureEnabled, loadSiteSettings, } from '../../stores/siteSettings';
import { loadEnabledPlugins, } from '../../stores/plugins';

/**
 * Page-level guard for the public /shop/* storefront. Mirrors the admin
 * ShopGuard: we wait for site settings to resolve so we don't flash the
 * disabled state, then render either the storefront page or a friendly
 * "store unavailable" panel when the `shop` feature is off. Rendering a
 * panel (rather than routing) keeps the public Layout chrome + `--site-*`
 * theme tokens applied.
 */
const ShopStoreGuard: ParentComponent = (props,) => {
    const [ready,] = createResource(async () => {
        // Load plugins alongside settings so isShopifyActive() is resolved before
        // children render (the Shopify plugin overrides the storefront when on).
        await Promise.all([loadSiteSettings(), loadEnabledPlugins(),],);
        return true;
    },);

    return (
        <Show when={ready()} fallback={<div class="shop-store__loading">Loading…</div>}>
            <Show
                when={isFeatureEnabled('shop',)}
                fallback={
                    <div class="shop-store__unavailable page-wrapper">
                        <h1>Store unavailable</h1>
                        <p>The shop is not currently available. Please check back later.</p>
                    </div>
                }
            >
                {props.children}
            </Show>
        </Show>
    );
};

export default ShopStoreGuard;
