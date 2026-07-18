/** Small shared helpers for the shop admin pages. */
import { formatCurrency, formatDate as formatDateShared, } from '@sitesurge/types';

/** Format an integer cents amount as a currency string (null/undefined → 0).
 *  Delegates to the shared `formatCurrency` so money formatting lives in one place. */
export function formatCents(cents: number | null | undefined, currency = 'USD',): string {
    return formatCurrency(cents ?? 0, currency,);
}

/** Parse a dollars string (e.g. "12.50") into integer cents. Empty → 0. */
export function dollarsToCents(dollars: string,): number {
    const n = parseFloat(dollars,);
    if (!Number.isFinite(n,)) return 0;
    return Math.round(n * 100,);
}

/** Render integer cents as an editable dollars string ("12.50"); 0 → "". */
export function centsToDollars(cents: number | null | undefined,): string {
    if (cents === null || cents === undefined) return '';
    return (cents / 100).toFixed(2,);
}

/** lowercase-hyphen slug from arbitrary text. */
export function slugify(text: string,): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-',)
        .replace(/(^-|-$)/g, '',);
}

/** Format an ISO date (null/undefined → em dash). Delegates to the shared
 *  `formatDate`, which already defaults to short-month/day/year. */
export function formatDate(iso: string | null | undefined,): string {
    return iso ? formatDateShared(iso,) : '—';
}
