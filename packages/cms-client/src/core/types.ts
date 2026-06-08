import type { CmsError, } from './errors';

export type AuthMode = 'bearer' | 'apiKey' | 'cookie';

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    /** ISO string or epoch ms; used to pre-empt refresh. Optional. */
    expiresAt?: string | number;
}

export interface TokenStore {
    load(): AuthTokens | null | Promise<AuthTokens | null>;
    save(tokens: AuthTokens,): void | Promise<void>;
    clear(): void | Promise<void>;
}

export interface RetryPolicy {
    /** max attempts (1 = no retry). */
    attempts: number;
    /** base backoff ms (exponential). */
    backoffMs: number;
    /** cap on backoff ms. */
    maxBackoffMs: number;
    /** statuses that trigger retry (besides network errors). */
    retryStatuses: number[];
}

export interface TtlMap {
    list: number;
    entity: number;
    settings: number;
    [resource: string]: number;
}

export type CacheAdapterKind = 'auto' | 'indexeddb' | 'localstorage' | 'memory';

export interface CacheAdapter {
    get<T>(key: string,): Promise<CacheEntry<T> | null>;
    set<T>(key: string, entry: CacheEntry<T>,): Promise<void>;
    delete(key: string,): Promise<void>;
    /** delete every key matching the prefix (for module invalidation). */
    deletePrefix(prefix: string,): Promise<void>;
    clear(): Promise<void>;
}

export interface CacheEntry<T> {
    value: T;
    /** epoch ms when written. */
    storedAt: number;
    /** epoch ms after which the entry is stale. */
    expiresAt: number;
}

export interface QueryOptions {
    /** false → bypass cache for this read. */
    cache?: boolean;
    /** override TTL (ms) for this read. */
    ttl?: number;
    /** AbortSignal to cancel. */
    signal?: AbortSignal;
}

export interface MutationOptions {
    /** opt a write into retry (off by default). */
    retry?: boolean;
    /** forward-compat idempotency key header. */
    idempotencyKey?: string;
    signal?: AbortSignal;
}

export interface CmsClientConfig {
    baseUrl: string;
    auth?: {
        mode?: AuthMode;
        apiKey?: string;
        tokens?: AuthTokens;
        store?: TokenStore | null;
        /** localStorage key for the default store. */
        storageKey?: string;
    };
    cache?: boolean | {
        adapter?: CacheAdapter | CacheAdapterKind;
        ttl?: Partial<TtlMap>;
        namespace?: string;
    };
    fetch?: typeof fetch;
    timeoutMs?: number;
    retry?: Partial<RetryPolicy>;
    headers?: Record<string, string>;
    onError?: (e: CmsError,) => void;
}

export interface ResolvedConfig {
    baseUrl: string;
    apiBase: string;
    authMode: AuthMode;
    apiKey?: string;
    initialTokens?: AuthTokens;
    storageKey: string;
    customStore?: TokenStore | null;
    cacheEnabled: boolean;
    cacheAdapter: CacheAdapter | CacheAdapterKind;
    ttl: TtlMap;
    namespace: string;
    fetchImpl: typeof fetch;
    timeoutMs: number;
    retry: RetryPolicy;
    headers: Record<string, string>;
    onError?: (e: CmsError,) => void;
}

export const DEFAULT_TTL: TtlMap = { list: 30_000, entity: 60_000, settings: 300_000, };
export const DEFAULT_RETRY: RetryPolicy = {
    attempts: 3, backoffMs: 300, maxBackoffMs: 5_000, retryStatuses: [429, 500, 502, 503, 504,],
};
