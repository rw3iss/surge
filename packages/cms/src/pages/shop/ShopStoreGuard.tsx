import { ParentComponent, } from 'solid-js';
import FeatureReadyGuard from '../../components/common/FeatureReadyGuard';

/**
 * Page-level guard for the public /shop/* storefront. Renders either the
 * storefront page or a friendly "store unavailable" panel when the `shop`
 * feature is off. Rendering a panel (rather than routing) keeps the public
 * Layout chrome + `--site-*` theme tokens applied. Shared gate/ready logic
 * lives in FeatureReadyGuard.
 */
const ShopStoreGuard: ParentComponent = (props,) => (
    <FeatureReadyGuard
        feature="shop"
        loading={<div class="shop-store__loading">Loading…</div>}
        fallback={
            <div class="shop-store__unavailable page-wrapper">
                <h1>Store unavailable</h1>
                <p>The shop is not currently available. Please check back later.</p>
            </div>
        }
    >
        {props.children}
    </FeatureReadyGuard>
);

export default ShopStoreGuard;
