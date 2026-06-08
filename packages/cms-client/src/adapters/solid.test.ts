import { describe, expect, it, vi, } from 'vitest';
import { createRoot, } from 'solid-js';
import { createCmsResource, bindCmsErrors, } from './solid';
import type { CmsClientCore, } from '../core/client';
import { CmsError, } from '../core/errors';

// ---------------------------------------------------------------------------
// Minimal fake core — exposes only subscribe + onError so tests stay isolated
// from network/auth/cache machinery.
// ---------------------------------------------------------------------------

type Subscriber = (value: unknown) => void;
type ErrorHandler = (e: CmsError) => void;

interface FakeCore {
    subscribe: CmsClientCore['subscribe'];
    onError: CmsClientCore['onError'];
    // Test helpers
    _emitCacheUpdate(module: string, path: string, args: unknown, value: unknown): void;
    _emitError(e: CmsError): void;
}

function makeFakeCore(namespace = 'cms',): FakeCore {
    const cacheSubs = new Map<string, Set<Subscriber>>();
    const errorSubs = new Set<ErrorHandler>();

    function cacheKey(module: string, method: string, args: unknown): string {
        // Mirrors core.cacheKeyFor(module, method, args ?? null) →
        // cacheKey(namespace, module, method, args) → `cms:<module>:<method>:<stableJson>`
        const hash = args === null || args === undefined
            ? ''
            : JSON.stringify(args);
        return `${namespace}:${module}:${method}:${hash}`;
    }

    return {
        subscribe<T>(module: string, method: string, args: unknown, cb: (value: T) => void): () => void {
            const key = cacheKey(module, method, args ?? null,);
            if (!cacheSubs.has(key,)) cacheSubs.set(key, new Set(),);
            cacheSubs.get(key,)!.add(cb as Subscriber,);
            return () => { cacheSubs.get(key,)?.delete(cb as Subscriber,); };
        },

        onError(handler: ErrorHandler): () => void {
            errorSubs.add(handler,);
            return () => { errorSubs.delete(handler,); };
        },

        _emitCacheUpdate(module: string, path: string, args: unknown, value: unknown): void {
            const key = cacheKey(module, path, args ?? null,);
            cacheSubs.get(key,)?.forEach((cb,) => cb(value,),);
        },

        _emitError(e: CmsError): void {
            errorSubs.forEach((h,) => h(e,),);
        },
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Yield to the microtask queue so async void refetch() can settle. */
function tick(): Promise<void> {
    return new Promise((r,) => setTimeout(r, 0,),);
}

// ---------------------------------------------------------------------------
// createCmsResource
// ---------------------------------------------------------------------------

describe('createCmsResource', () => {
    it('seeds the signal from the fetcher after the initial tick', async () => {
        const core = makeFakeCore();
        const fetcher = vi.fn().mockResolvedValue([{ id: '1', },],);

        let accessor!: () => unknown;
        const dispose = createRoot((d,) => {
            [accessor,] = createCmsResource(core as unknown as CmsClientCore, 'posts', '/posts', null, fetcher,);
            return d;
        },);

        // Before the async fetcher resolves the signal is undefined.
        expect(accessor(),).toBeUndefined();

        await tick();
        expect(accessor(),).toEqual([{ id: '1', },],);
        expect(fetcher,).toHaveBeenCalledOnce();

        dispose();
    },);

    it('updates the signal when the cache emits a background SWR value', async () => {
        const core = makeFakeCore();
        const fetcher = vi.fn().mockResolvedValue([{ id: '1', },],);

        let accessor!: () => unknown;
        const dispose = createRoot((d,) => {
            [accessor,] = createCmsResource(core as unknown as CmsClientCore, 'posts', '/posts', null, fetcher,);
            return d;
        },);

        await tick();
        expect(accessor(),).toEqual([{ id: '1', },],);

        // Simulate a background SWR revalidation emitting a changed value.
        const updated = [{ id: '1', }, { id: '2', },];
        core._emitCacheUpdate('posts', '/posts', null, updated,);
        expect(accessor(),).toEqual(updated,);

        dispose();
    },);

    it('passes args to the subscribe key so the correct channel updates', async () => {
        const core = makeFakeCore();
        const query = { page: 2, };
        const fetcher = vi.fn().mockResolvedValue([{ id: 'p2', },],);

        let accessor!: () => unknown;
        const dispose = createRoot((d,) => {
            [accessor,] = createCmsResource(
                core as unknown as CmsClientCore, 'posts', '/posts', query, fetcher,
            );
            return d;
        },);

        await tick();

        // Emit on a DIFFERENT key (page 1) — should NOT update our accessor.
        core._emitCacheUpdate('posts', '/posts', { page: 1, }, [{ id: 'p1', },],);
        expect(accessor(),).toEqual([{ id: 'p2', },],);

        // Emit on the correct key (page 2) — SHOULD update.
        core._emitCacheUpdate('posts', '/posts', { page: 2, }, [{ id: 'p2-updated', },],);
        expect(accessor(),).toEqual([{ id: 'p2-updated', },],);

        dispose();
    },);

    it('swallows fetcher errors (they surface on the error bus)', async () => {
        const core = makeFakeCore();
        const fetcher = vi.fn().mockRejectedValue(
            new CmsError('Not found', { code: 'NOT_FOUND', status: 404, },),
        );

        let accessor!: () => unknown;
        const dispose = createRoot((d,) => {
            [accessor,] = createCmsResource(core as unknown as CmsClientCore, 'posts', '/posts/x', null, fetcher,);
            return d;
        },);

        // Should not throw even though fetcher rejects.
        await expect(tick(),).resolves.toBeUndefined();
        // Value stays undefined when the fetch fails.
        expect(accessor(),).toBeUndefined();

        dispose();
    },);

    it('refetch() manually re-runs the fetcher and updates the signal', async () => {
        const core = makeFakeCore();
        const fetcher = vi.fn()
            .mockResolvedValueOnce([{ id: '1', },],)
            .mockResolvedValueOnce([{ id: '1', }, { id: '2', },],);

        let accessor!: () => unknown;
        let ctrl!: { refetch: () => Promise<void>; };
        const dispose = createRoot((d,) => {
            [accessor, ctrl,] = createCmsResource(core as unknown as CmsClientCore, 'posts', '/posts', null, fetcher,);
            return d;
        },);

        await tick();
        expect(accessor(),).toEqual([{ id: '1', },],);

        await ctrl.refetch();
        expect(accessor(),).toEqual([{ id: '1', }, { id: '2', },],);
        expect(fetcher,).toHaveBeenCalledTimes(2,);

        dispose();
    },);

    it('cleans up the subscription on dispose', async () => {
        const core = makeFakeCore();
        const fetcher = vi.fn().mockResolvedValue([],);

        let accessor!: () => unknown;
        const dispose = createRoot((d,) => {
            [accessor,] = createCmsResource(core as unknown as CmsClientCore, 'posts', '/posts', null, fetcher,);
            return d;
        },);

        await tick();
        dispose(); // triggers onCleanup

        // Emit after cleanup — value should NOT change (no live subscribers).
        const before = accessor();
        core._emitCacheUpdate('posts', '/posts', null, [{ id: 'ghost', },],);
        expect(accessor(),).toBe(before,);
    },);
},);

// ---------------------------------------------------------------------------
// bindCmsErrors
// ---------------------------------------------------------------------------

describe('bindCmsErrors', () => {
    it('delivers CmsError from the error bus to the handler', () => {
        const core = makeFakeCore();
        const handler = vi.fn();

        const dispose = createRoot((d,) => {
            bindCmsErrors(core as unknown as CmsClientCore, handler,);
            return d;
        },);

        const err = new CmsError('boom', { code: 'INTERNAL_ERROR', status: 500, },);
        core._emitError(err,);
        expect(handler,).toHaveBeenCalledWith(err,);
        expect(handler,).toHaveBeenCalledOnce();

        dispose();
    },);

    it('stops delivering errors after the scope is disposed', () => {
        const core = makeFakeCore();
        const handler = vi.fn();

        const dispose = createRoot((d,) => {
            bindCmsErrors(core as unknown as CmsClientCore, handler,);
            return d;
        },);

        dispose(); // triggers onCleanup

        core._emitError(new CmsError('late', { code: 'UNKNOWN_ERROR', status: 0, },),);
        expect(handler,).not.toHaveBeenCalled();
    },);

    it('delivers multiple distinct errors in order', () => {
        const core = makeFakeCore();
        const received: string[] = [];

        const dispose = createRoot((d,) => {
            bindCmsErrors(core as unknown as CmsClientCore, (e,) => received.push(e.message,),);
            return d;
        },);

        core._emitError(new CmsError('first', { code: 'INTERNAL_ERROR', status: 500, },),);
        core._emitError(new CmsError('second', { code: 'NOT_FOUND', status: 404, },),);
        expect(received,).toEqual(['first', 'second',],);

        dispose();
    },);
},);
