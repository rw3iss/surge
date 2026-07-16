/**
 * Shop reviews service — public approved-only reads (cache-safe), admin
 * moderation queue, review submission, and the denormalized rating
 * recompute on the product.
 *
 * Caching note: the public review list is approved-only via the repo, so
 * it is safe to cache for anonymous readers (mirrors the products module).
 * Moderation / delete change the approved set → they recompute the
 * product's `rating_avg`/`rating_count` and bust both the review cache and
 * the product caches (rating is denormalized onto the product row).
 */
import type { ShopReview, ShopReviewStatus, } from '@sitesurge/types';
import { query, transaction, } from '../../db';
import * as repo from '../../repositories/shop/shopReviews.repo';
import { logAudit, } from '../audit';
import { cache, } from '../cache';
import type { AuditContext, ListResult, PaginationOpts, } from '../types';

function reviewListCacheKey(productId: string, page: number, limit: number, sort?: string,): string {
    return cache.CACHE_KEYS.shopReviews(productId, sort ?? 'newest', page, limit,);
}

// ─── Public reads (approved-only — cache freely for anonymous) ──────

/** Public review list for a product with anonymous caching. Approved-only
 *  → safe. */
export async function listPublic(
    productId: string,
    pagination: PaginationOpts = {},
    sort?: string,
): Promise<ListResult<ShopReview>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const cacheKey = reviewListCacheKey(productId, page, limit, sort,);

    const cached = await cache.get<ListResult<ShopReview>>(cacheKey,);
    if (cached) return cached;

    const result = await repo.findPublicReviews(productId, { page, limit, }, sort,);
    const out: ListResult<ShopReview> = {
        data: result.data,
        meta: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit,), },
    };
    await cache.set(cacheKey, out, 300,);
    return out;
}

// ─── Admin reads (any status) ─────────────────────────────────────

export async function listAdmin(
    filters: repo.ReviewListFilters = {},
    pagination: PaginationOpts = {},
): Promise<ListResult<ShopReview>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const result = await repo.findAllReviews(filters, { page, limit, },);
    return {
        data: result.data,
        meta: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit,), },
    };
}

export async function get(id: string,): Promise<ShopReview | null> {
    try {
        return await repo.findReviewById(id,);
    } catch {
        return null;
    }
}

// ─── Writes ───────────────────────────────────────────────────────

export interface ReviewCreateInput {
    productId: string;
    rating: number;
    title?: string | null;
    body?: string | null;
}

/** Does this user have a paid order containing this product? Sets the
 *  verified-purchase badge. Paid-ish statuses count as a purchase. */
async function hasVerifiedPurchase(userId: string, productId: string,): Promise<boolean> {
    const result = await query(
        `SELECT 1
             FROM shop_order_items oi
             JOIN shop_orders o ON o.id = oi.order_id
             WHERE o.user_id = $1
               AND oi.product_id = $2
               AND o.status IN ('paid', 'processing', 'shipped', 'delivered')
             LIMIT 1`,
        [userId, productId,],
    );
    return result.rows.length > 0;
}

/**
 * A logged-in user submits a review. Always created `status = 'pending'`
 * (admin moderates). Sets `verified_purchase` from a real paid-order
 * lookup. No rating recompute — pending reviews don't count.
 */
export async function create(input: ReviewCreateInput, ctx: AuditContext,): Promise<ShopReview> {
    const verifiedPurchase = await hasVerifiedPurchase(ctx.userId, input.productId,);
    const review = await repo.createReview({
        productId: input.productId,
        userId: ctx.userId,
        rating: input.rating,
        title: input.title ?? null,
        body: input.body ?? null,
        verifiedPurchase,
    },);
    await cache.invalidateShopReviewCache(input.productId,);
    await logAudit({
        userId: ctx.userId,
        action: 'create',
        entityType: 'shop-review',
        entityId: review.id,
        newValues: { productId: input.productId, rating: input.rating, },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
    },);
    return review;
}

/**
 * Admin approve/reject. Transactionally flips the status and recomputes
 * the product's denormalized rating (the approved set changed). Busts the
 * review cache + the product caches.
 */
export async function moderate(
    id: string,
    status: Extract<ShopReviewStatus, 'approved' | 'rejected'>,
    ctx: AuditContext,
): Promise<ShopReview> {
    const review = await transaction(async (client,) => {
        const updated = await repo.updateReviewStatus(id, status, client,);
        await repo.recomputeProductRating(updated.productId, client,);
        return updated;
    },);
    await cache.invalidateShopReviewCache(review.productId,);
    await logAudit({
        userId: ctx.userId,
        action: 'update',
        entityType: 'shop-review',
        entityId: id,
        newValues: { status, },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
    },);
    return review;
}

/** Admin delete. If the review was approved, recompute the product rating. */
export async function remove(id: string, ctx: AuditContext,): Promise<ShopReview | null> {
    let existing: ShopReview;
    try {
        existing = await repo.findReviewById(id,);
    } catch {
        return null;
    }
    await repo.deleteReview(id,);
    if (existing.status === 'approved') {
        await repo.recomputeProductRating(existing.productId,);
    }
    // invalidateShopReviewCache busts the review list + the product caches
    // (rating is denormalized onto the product row).
    await cache.invalidateShopReviewCache(existing.productId,);
    await logAudit({
        userId: ctx.userId,
        action: 'delete',
        entityType: 'shop-review',
        entityId: id,
        oldValues: existing as unknown as Record<string, unknown>,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
    },);
    return existing;
}

/** Increment a review's helpful count. Public; busts that product's
 *  review cache lightly. */
export async function markHelpful(id: string,): Promise<{ helpfulCount: number; }> {
    const review = await repo.findReviewById(id,);
    const helpfulCount = await repo.incrementHelpful(id,);
    await cache.invalidateShopReviewCache(review.productId,);
    return { helpfulCount, };
}
