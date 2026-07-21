/**
 * Shop reviews repository — product reviews + ratings with moderation and
 * the denormalized rating aggregate on `shop_products`.
 *
 * Public reads are approved-only (`status = 'approved'`); admin reads see
 * any status. New reviews default to `status = 'pending'` (moderated).
 * `recomputeProductRating` re-derives `rating_avg`/`rating_count` from the
 * approved rows — call it after any create/status-change/delete that
 * affects the approved set. Follows the shopProducts.repo style:
 * base.repo helpers + mapRow + uuidOrNull for the nullable FKs.
 */
import type { ShopReview, ShopReviewStatus, } from '@sitesurge/types';
import type { PoolClient, } from 'pg';
import { query, } from '../../db';
import { mapRow, } from '../../utils/mapRow';
import { uuidOrNull, } from '../../utils/uuid';
import {
    deleteById,
    findByIdOrThrow,
    paginatedQuery,
    PaginatedResult,
    PaginationOptions,
} from '../base.repo';

export interface ReviewListFilters {
    productId?: string;
    status?: ShopReviewStatus;
    sort?: string;
}

function buildReviewSortClause(sort?: string,): string {
    // 'helpful' → most-helpful first; anything else → newest first.
    if (sort === 'helpful') return 'ORDER BY helpful_count DESC, created_at DESC';
    return 'ORDER BY created_at DESC';
}

// ─── Lists ────────────────────────────────────────────────────────

/** Public reviews for a product — approved-only, paginated (newest or
 *  most-helpful). Cache-safe (no admin bypass in the query). */
export async function findPublicReviews(
    productId: string,
    pagination: PaginationOptions,
    sort?: string,
): Promise<PaginatedResult<ShopReview>> {
    const whereClause = `WHERE product_id = $1 AND status = 'approved'`;
    const orderClause = buildReviewSortClause(sort,);
    return paginatedQuery<ShopReview>(
        `SELECT * FROM shop_reviews ${whereClause} ${orderClause}`,
        `SELECT COUNT(*) FROM shop_reviews ${whereClause}`,
        [productId,],
        pagination,
    );
}

/** Admin review list — any status, optional product/status filter. */
export async function findAllReviews(
    filters: ReviewListFilters,
    pagination: PaginationOptions,
): Promise<PaginatedResult<ShopReview>> {
    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (filters.productId) {
        params.push(filters.productId,);
        whereClause += ` AND product_id = $${params.length}`;
    }
    if (filters.status) {
        params.push(filters.status,);
        whereClause += ` AND status = $${params.length}`;
    }

    const orderClause = buildReviewSortClause(filters.sort,);
    return paginatedQuery<ShopReview>(
        // Correlated subquery for the product title (avoids JOIN ambiguity with
        // the shared created_at/status columns used by where/order clauses).
        `SELECT *, (SELECT title FROM shop_products WHERE id = shop_reviews.product_id) AS product_title
             FROM shop_reviews ${whereClause} ${orderClause}`,
        `SELECT COUNT(*) FROM shop_reviews ${whereClause}`,
        params,
        pagination,
    );
}

// ─── Single reads ─────────────────────────────────────────────────

export async function findReviewById(id: string,): Promise<ShopReview> {
    return findByIdOrThrow<ShopReview>('shop_reviews', id, 'Review',);
}

// ─── Writes ───────────────────────────────────────────────────────

export interface ReviewCreateInput {
    productId: string;
    userId?: string | null;
    orderId?: string | null;
    rating: number;
    title?: string | null;
    body?: string | null;
    verifiedPurchase?: boolean;
}

/** Insert a review. Always created `status = 'pending'` (moderated). */
export async function createReview(input: ReviewCreateInput,): Promise<ShopReview> {
    const result = await query(
        `INSERT INTO shop_reviews (product_id, user_id, order_id, rating, title, body,
                                   status, verified_purchase)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
             RETURNING *`,
        [
            input.productId,
            // user_id / order_id are UUID FKs; synthetic/absent actors → NULL.
            uuidOrNull(input.userId ?? null,),
            uuidOrNull(input.orderId ?? null,),
            input.rating,
            input.title ?? null,
            input.body ?? null,
            input.verifiedPurchase ?? false,
        ],
    );
    return mapRow<ShopReview>(result.rows[0],);
}

/** Approve / reject a review. Optionally within the caller's txn client. */
export async function updateReviewStatus(
    id: string,
    status: ShopReviewStatus,
    client?: PoolClient,
): Promise<ShopReview> {
    const sql = `UPDATE shop_reviews SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const params = [id, status,];
    const result = client ? await client.query(sql, params,) : await query(sql, params,);
    return mapRow<ShopReview>(result.rows[0],);
}

export async function deleteReview(id: string,): Promise<void> {
    return deleteById('shop_reviews', id, 'Review',);
}

// ─── Helpful marks (deduped by user_id OR ip_address) ─────────────

/** True when this review already has a helpful mark from this user or IP. */
export async function hasHelpfulMark(
    reviewId: string,
    userId: string | null,
    ip: string | null,
): Promise<boolean> {
    const result = await query(
        `SELECT 1 FROM shop_review_helpful
         WHERE review_id = $1
           AND (($2::uuid IS NOT NULL AND user_id = $2::uuid) OR ($3::text IS NOT NULL AND ip_address = $3::text))
         LIMIT 1`,
        [reviewId, uuidOrNull(userId,), ip || null,],
    );
    return result.rows.length > 0;
}

/** Record a helpful mark + increment the review's count. Returns new count. */
export async function addHelpfulMark(
    reviewId: string,
    userId: string | null,
    ip: string | null,
): Promise<number> {
    await query(
        `INSERT INTO shop_review_helpful (review_id, user_id, ip_address) VALUES ($1, $2, $3)`,
        [reviewId, uuidOrNull(userId,), ip || null,],
    );
    const result = await query(
        `UPDATE shop_reviews SET helpful_count = helpful_count + 1 WHERE id = $1 RETURNING helpful_count`,
        [reviewId,],
    );
    return (result.rows[0]?.helpful_count as number) ?? 0;
}

/** Remove this user/IP's helpful mark(s) + decrement the count (clamped ≥ 0).
 *  Returns the new count. */
export async function removeHelpfulMark(
    reviewId: string,
    userId: string | null,
    ip: string | null,
): Promise<number> {
    const del = await query(
        `DELETE FROM shop_review_helpful
         WHERE review_id = $1
           AND (($2::uuid IS NOT NULL AND user_id = $2::uuid) OR ($3::text IS NOT NULL AND ip_address = $3::text))
         RETURNING id`,
        [reviewId, uuidOrNull(userId,), ip || null,],
    );
    const removed = del.rows.length;
    const result = await query(
        `UPDATE shop_reviews SET helpful_count = GREATEST(0, helpful_count - $2) WHERE id = $1 RETURNING helpful_count`,
        [reviewId, removed,],
    );
    return (result.rows[0]?.helpful_count as number) ?? 0;
}

/** Review ids under a product that this user/IP has marked helpful. */
export async function findHelpfulReviewIds(
    productId: string,
    userId: string | null,
    ip: string | null,
): Promise<string[]> {
    const result = await query(
        `SELECT DISTINCT h.review_id
         FROM shop_review_helpful h
         JOIN shop_reviews r ON r.id = h.review_id
         WHERE r.product_id = $1
           AND (($2::uuid IS NOT NULL AND h.user_id = $2::uuid) OR ($3::text IS NOT NULL AND h.ip_address = $3::text))`,
        [productId, uuidOrNull(userId,), ip || null,],
    );
    return result.rows.map((r,) => r.review_id as string);
}

/**
 * Recompute the denormalized rating aggregate on a product from its
 * APPROVED reviews. Accepts an optional client so it can run inside the
 * same transaction as a status change. Call after any create (if
 * auto-approved) / status-change / delete affecting approved reviews.
 */
export async function recomputeProductRating(productId: string, client?: PoolClient,): Promise<void> {
    const sql = `UPDATE shop_products SET
             rating_avg = COALESCE(
                 (SELECT AVG(rating) FROM shop_reviews WHERE product_id = $1 AND status = 'approved'), 0),
             rating_count =
                 (SELECT COUNT(*) FROM shop_reviews WHERE product_id = $1 AND status = 'approved')
         WHERE id = $1`;
    const params = [productId,];
    if (client) await client.query(sql, params,);
    else await query(sql, params,);
}
