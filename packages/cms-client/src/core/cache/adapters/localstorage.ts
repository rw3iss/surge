import type { CacheAdapter, CacheEntry, } from '../../types';

/** localStorage adapter. Keys are prefixed so deletePrefix/clear only
 *  touch this client's entries. */
export class LocalStorageAdapter implements CacheAdapter {
    constructor(private prefix = 'cms-cache:',) {}
    private k(key: string,): string { return this.prefix + key; }
    async get<T>(key: string,): Promise<CacheEntry<T> | null> {
        try { const raw = localStorage.getItem(this.k(key,),); return raw ? JSON.parse(raw,) as CacheEntry<T> : null; }
        catch { return null; }
    }
    async set<T>(key: string, entry: CacheEntry<T>,): Promise<void> {
        try { localStorage.setItem(this.k(key,), JSON.stringify(entry,),); } catch { /* quota: best effort */ }
    }
    async delete(key: string,): Promise<void> { try { localStorage.removeItem(this.k(key,),); } catch { /* ignore */ } }
    async deletePrefix(prefix: string,): Promise<void> {
        const full = this.k(prefix,);
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i,);
            if (key && key.startsWith(full,)) toRemove.push(key,);
        }
        for (const key of toRemove) localStorage.removeItem(key,);
    }
    async clear(): Promise<void> { await this.deletePrefix('',); }
}
