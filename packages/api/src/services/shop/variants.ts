/**
 * Shop variants service — minimal ops beyond the product structure sync.
 * Most variant writes flow through the product save
 * (`products.update` → `replaceProductStructure`); this module exposes the
 * inventory adjustment used by the checkout/webhook flow (Phase 4).
 */
import { query, } from '../../db';
import { cache, } from '../cache';

/**
 * Atomically adjust a variant's inventory by `delta` (negative to
 * decrement). Returns the new quantity, or null if the variant is absent.
 * Guards against oversell when `guardNonNegative` is set: the update only
 * applies when the resulting quantity stays ≥ 0.
 */
export async function adjustInventory(
    variantId: string,
    delta: number,
    guardNonNegative = true,
): Promise<number | null> {
    const guard = guardNonNegative && delta < 0 ? ` AND inventory_qty + $2 >= 0` : '';
    const result = await query(
        `UPDATE shop_variants SET inventory_qty = inventory_qty + $2
             WHERE id = $1${guard}
             RETURNING inventory_qty`,
        [variantId, delta,],
    );
    if (result.rows.length === 0) return null;
    await cache.invalidateShopProductSlugCache();
    return result.rows[0].inventory_qty as number;
}
