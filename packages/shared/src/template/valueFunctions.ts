/**
 * Shared `{{ … }}` value/utility functions.
 *
 * These are the pure, data-only helpers usable from ANY template runtime:
 * string/number/date formatting and value fallbacks. They intentionally have no
 * knowledge of entities, the SDK, or collections — every runtime (content SSR,
 * the client renderer, form-email templates) delegates its utility-function
 * cases here so the surface is defined once.
 *
 * A runtime's `resolve(name, args)` should try this FIRST and fall through to
 * its own entity/collection logic when it returns the `UNRESOLVED` sentinel:
 *
 *   const v = resolveValueFunction(name, args);
 *   if (v !== UNRESOLVED) return v;   // handled here
 *   // …runtime-specific names (post, posts, …)…
 */
import { formatCurrency, formatDate, formatNumber, } from '../utils/format';
import { truncate, } from '../utils/validation';

/** Returned when `name` is not one of the shared value functions, so callers
 *  can distinguish "not mine" from a function that legitimately returns
 *  `undefined`/empty. */
export const UNRESOLVED: unique symbol = Symbol('template.unresolved',);

const s = (v: unknown,): string => (v == null ? '' : String(v,));

/** Names of the shared value functions (for help/reference UIs). */
export const VALUE_FUNCTION_NAMES = [
    'upper', 'lower', 'trim', 'truncate', 'formatDate', 'formatCurrency',
    'formatNumber', 'default', 'now', 'year',
] as const;

/**
 * Resolve a shared value function. Returns `UNRESOLVED` when `name` isn't one
 * (so the caller can handle its own function names).
 */
export function resolveValueFunction(name: string, args: unknown[],): unknown | typeof UNRESOLVED {
    switch (name) {
        case 'upper': return s(args[0],).toUpperCase();
        case 'lower': return s(args[0],).toLowerCase();
        case 'trim': return s(args[0],).trim();
        case 'truncate': return truncate(s(args[0],), typeof args[1] === 'number' ? (args[1] as number) : 100,);
        case 'formatDate': return args[0] ? formatDate(args[0] as string | Date,) : '';
        case 'formatCurrency': return formatCurrency(Number(args[0],) || 0, args[1] ? s(args[1],) : undefined,);
        case 'formatNumber': return formatNumber(Number(args[0],) || 0,);
        case 'default': return args[0] == null || args[0] === '' ? args[1] : args[0];
        case 'now': return new Date();
        case 'year': return new Date().getFullYear();
        default: return UNRESOLVED;
    }
}
