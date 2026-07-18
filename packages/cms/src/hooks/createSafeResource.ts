import { createResource, } from 'solid-js';

/**
 * `createResource` for the ubiquitous "fetch, but never throw — fall back to a
 * default" pattern that was hand-rolled as
 * `createResource(async () => { try { return await x(); } catch { return d; } })`
 * across dozens of pages. Keeps the same reactive Resource ergonomics
 * (`.loading`, `()` accessor) while removing the repeated try/catch boilerplate.
 *
 * Errors are swallowed by design (these are non-critical reads whose failures
 * surface through the client's global error bus); use plain `createResource`
 * when a caller needs to react to the error itself.
 */
export function createSafeResource<T>(fetcher: () => Promise<T>, fallback: T,) {
    return createResource(async () => {
        try {
            return await fetcher();
        } catch {
            return fallback;
        }
    },);
}
