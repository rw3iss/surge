import type { CacheAdapter, CacheAdapterKind, } from '../../types';
import { IndexedDbAdapter, } from './indexeddb';
import { LocalStorageAdapter, } from './localstorage';
import { MemoryAdapter, } from './memory';

/** Resolve an adapter spec to a concrete adapter. 'auto' picks the best
 *  available: IndexedDB → localStorage → memory. */
export function resolveAdapter(spec: CacheAdapter | CacheAdapterKind, namespace: string,): CacheAdapter {
    if (typeof spec === 'object') return spec;
    const hasIdb = typeof indexedDB !== 'undefined';
    const hasLs = (() => { try { return typeof localStorage !== 'undefined' && localStorage !== null; } catch { return false; } })();
    switch (spec) {
        case 'indexeddb': return new IndexedDbAdapter(`${namespace}-cache`,);
        case 'localstorage': return new LocalStorageAdapter(`${namespace}-cache:`,);
        case 'memory': return new MemoryAdapter();
        case 'auto':
        default:
            if (hasIdb) return new IndexedDbAdapter(`${namespace}-cache`,);
            if (hasLs) return new LocalStorageAdapter(`${namespace}-cache:`,);
            return new MemoryAdapter();
    }
}
