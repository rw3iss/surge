/**
 * Small SQL fragment builders shared by the repositories.
 */

/**
 * Build a case-insensitive OR-search fragment across several columns
 * against a single `%term%` parameter. Pushes exactly one parameter onto
 * `params` (the wrapped term) and returns a parenthesised fragment like
 * `(colA ILIKE $3 OR colB ILIKE $3)` referencing that parameter.
 *
 *   whereClause += ` AND ${ilikeSearch(['title', 'slug'], search, params)}`;
 */
export function ilikeSearch(columns: string[], term: string, params: unknown[],): string {
    params.push(`%${term}%`,);
    const n = params.length;
    return `(${columns.map((col,) => `${col} ILIKE $${n}`,).join(' OR ',)})`;
}
