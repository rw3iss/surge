/** Shim — canonical shop services live under services/shop/. Re-exported
 *  as grouped sub-namespaces so `cms.shop.products.*` etc. work for
 *  scripts and plugins. Later phases add reviews/orders/checkout/settings. */
export * from '../services/shop';
