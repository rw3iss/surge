import type { CacheAdapter, CacheEntry, } from '../../types';

export class MemoryAdapter implements CacheAdapter {
    private map = new Map<string, CacheEntry<unknown>>();
    async get<T>(key: string,): Promise<CacheEntry<T> | null> { return (this.map.get(key,) as CacheEntry<T>) ?? null; }
    async set<T>(key: string, entry: CacheEntry<T>,): Promise<void> { this.map.set(key, entry,); }
    async delete(key: string,): Promise<void> { this.map.delete(key,); }
    async deletePrefix(prefix: string,): Promise<void> {
        for (const k of this.map.keys()) if (k.startsWith(prefix,)) this.map.delete(k,);
    }
    async clear(): Promise<void> { this.map.clear(); }
}
