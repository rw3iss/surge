import { createSignal, onCleanup, } from 'solid-js';
import type { CmsClientCore, } from '../core/client';
import type { CmsError, } from '../core/errors';

/**
 * Create a reactive SWR resource backed by a CmsClientCore cached GET.
 *
 * Returns `[accessor, { refetch }]`.  The accessor is `T | undefined` until
 * the initial fetch resolves; refetch() re-runs the fetcher manually.
 *
 * KEY ALIGNMENT — the `(module, path, args)` triple MUST match the cache key
 * the core built when the corresponding `send()` was called:
 *
 *   core.send({ module: 'posts', method: 'GET', path: '/posts', query: { page: 1 } })
 *   // cache key: cms:posts:/posts:{"page":1}
 *
 *   createCmsResource(core, 'posts', '/posts', { page: 1 }, fetcher)
 *   // subscribe key: cms:posts:/posts:{"page":1}  ← same ✓
 *
 * `method` is the **route path** (e.g. `'/posts'`, `'/posts/:id'` already
 * interpolated), NOT the HTTP verb.  `args` is the query object (or `null`).
 *
 * Errors thrown by the fetcher are swallowed here — they surface on the
 * core's error bus (wire `bindCmsErrors` to handle them reactively).
 *
 * @param core     - The CmsClientCore instance.
 * @param module   - Module name, e.g. `'posts'`.
 * @param path     - Route path used as the cache-key method segment, e.g. `'/posts'`.
 * @param args     - Query object (or null) matching the GET's `query`.
 * @param fetcher  - Async function that calls the real module method, e.g.
 *                   `() => cms.posts.list({ page: 1 })`.
 */
export function createCmsResource<T>(
    core: CmsClientCore,
    module: string,
    path: string,
    args: unknown,
    fetcher: () => Promise<T>,
): [() => T | undefined, { refetch: () => Promise<void>; }] {
    const [value, setValue,] = createSignal<T | undefined>(undefined,);

    const refetch = async (): Promise<void> => {
        try {
            setValue((await fetcher()) as never,);
        } catch {
            /* errors surface on core.onError / error bus */
        }
    };

    // Seed immediately on mount.
    void refetch();

    // Subscribe for SWR background updates: when the cache revalidates and
    // the value changes, core.subscribe fires our callback.
    const off = core.subscribe<T>(module, path, args, (v,) => setValue(v as never,),);
    onCleanup(off,);

    return [value, { refetch, },];
}

/**
 * Bind the CmsClientCore error bus to a reactive handler inside a Solid
 * tracking scope.  The subscription is torn down automatically on cleanup.
 *
 * @example
 * createRoot(() => {
 *   const [error, setError] = createSignal<CmsError | null>(null);
 *   bindCmsErrors(core, setError);
 * });
 */
export function bindCmsErrors(core: CmsClientCore, onError: (e: CmsError,) => void,): void {
    const off = core.onError(onError,);
    onCleanup(off,);
}
