import type { CacheAdapter, CacheEntry, } from '../../types';

const STORE = 'entries';

/** IndexedDB adapter — one object store keyed by the cache key. */
export class IndexedDbAdapter implements CacheAdapter {
    private dbPromise: Promise<IDBDatabase>;
    constructor(dbName = 'cms-cache',) { this.dbPromise = this.open(dbName,); }

    private open(name: string,): Promise<IDBDatabase> {
        return new Promise((resolve, reject,) => {
            const req = indexedDB.open(name, 1,);
            req.onupgradeneeded = () => { req.result.createObjectStore(STORE,); };
            req.onsuccess = () => resolve(req.result,);
            req.onerror = () => reject(req.error,);
        },);
    }

    private async tx(mode: IDBTransactionMode,): Promise<IDBObjectStore> {
        const db = await this.dbPromise;
        return db.transaction(STORE, mode,).objectStore(STORE,);
    }

    async get<T>(key: string,): Promise<CacheEntry<T> | null> {
        const store = await this.tx('readonly',);
        return new Promise((resolve, reject,) => {
            const req = store.get(key,);
            req.onsuccess = () => resolve((req.result as CacheEntry<T>) ?? null,);
            req.onerror = () => reject(req.error,);
        },);
    }
    async set<T>(key: string, entry: CacheEntry<T>,): Promise<void> {
        const store = await this.tx('readwrite',);
        return new Promise((resolve, reject,) => {
            const req = store.put(entry, key,);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error,);
        },);
    }
    async delete(key: string,): Promise<void> {
        const store = await this.tx('readwrite',);
        return new Promise((resolve, reject,) => {
            const req = store.delete(key,);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error,);
        },);
    }
    async deletePrefix(prefix: string,): Promise<void> {
        const store = await this.tx('readwrite',);
        return new Promise((resolve, reject,) => {
            const req = store.openCursor();
            req.onsuccess = () => {
                const cursor = req.result;
                if (!cursor) { resolve(); return; }
                if (String(cursor.key,).startsWith(prefix,)) cursor.delete();
                cursor.continue();
            };
            req.onerror = () => reject(req.error,);
        },);
    }
    async clear(): Promise<void> {
        const store = await this.tx('readwrite',);
        return new Promise((resolve, reject,) => {
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error,);
        },);
    }
}
