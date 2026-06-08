import type { AuthTokens, TokenStore, } from '../types';

/** localStorage-backed store (browser). Falls back to an in-memory map
 *  when localStorage is unavailable (Node/SSR). */
export function createDefaultTokenStore(storageKey: string,): TokenStore {
    const hasLs = (() => {
        try { return typeof localStorage !== 'undefined' && localStorage !== null; } catch { return false; }
    })();
    if (!hasLs) {
        let mem: AuthTokens | null = null;
        return { load: () => mem, save: (t,) => { mem = t; }, clear: () => { mem = null; }, };
    }
    return {
        load() {
            try { const raw = localStorage.getItem(storageKey,); return raw ? JSON.parse(raw,) as AuthTokens : null; }
            catch { return null; }
        },
        save(tokens,) { try { localStorage.setItem(storageKey, JSON.stringify(tokens,),); } catch { /* quota */ } },
        clear() { try { localStorage.removeItem(storageKey,); } catch { /* ignore */ } },
    };
}
