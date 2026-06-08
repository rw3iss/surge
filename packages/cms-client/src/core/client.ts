import type { CmsClientConfig, MutationOptions, QueryOptions, ResolvedConfig, } from './types';
import type { AuthResponse, LoginCredentials, } from '@rw/cms-shared';
import { resolveConfig, } from './config';
import { AuthManager, } from './auth/authManager';
import { createDefaultTokenStore, } from './auth/tokenStore';
import { CacheManager, } from './cache/cacheManager';
import { resolveAdapter, } from './cache/adapters/detect';
import { cacheKey, cacheKeyPrefix, } from './cache/keys';
import { performRequest, } from './request';
import { withRetry, } from './retry';
import { joinUrl, } from './url';
import { CmsError, UnauthorizedError, } from './errors';
import { Emitter, } from './events';

export interface InternalRequest {
    module: string;
    method: string;            // HTTP verb
    path: string;              // e.g. '/posts/:id' (already interpolated by caller)
    query?: Record<string, unknown>;
    body?: unknown;
    raw?: boolean;
    rootMounted?: boolean;     // feed/sitemap: skip /api/v1 prefix
    options?: MutationOptions & QueryOptions;
}

/** The wired client. Modules call `client.send()`; consumers use the
 *  public surface (auth, cache, onError) + the assembled `cms.<module>`. */
export class CmsClientCore {
    readonly config: ResolvedConfig;
    readonly auth: AuthManager;
    readonly cache: CacheManager;
    private errorBus = new Emitter<{ error: CmsError }>();

    constructor(rawConfig: CmsClientConfig,) {
        this.config = resolveConfig(rawConfig,);
        const store = this.config.authMode === 'bearer'
            ? (this.config.customStore === undefined ? createDefaultTokenStore(this.config.storageKey,) : this.config.customStore)
            : undefined;
        this.auth = new AuthManager({
            mode: this.config.authMode, apiBase: this.config.apiBase, fetchImpl: this.config.fetchImpl,
            apiKey: this.config.apiKey, tokens: this.config.initialTokens, store,
        },);
        this.cache = new CacheManager({
            adapter: resolveAdapter(this.config.cacheAdapter, this.config.namespace,),
            enabled: this.config.cacheEnabled, defaultTtl: this.config.ttl.list,
        },);
        if (this.config.onError) this.onError(this.config.onError,);
    }

    /** Subscribe to every CmsError thrown by any call (toast/log/custom). */
    onError(handler: (e: CmsError,) => void,): () => void { return this.errorBus.on('error', handler,); }

    cacheKeyFor(module: string, method: string, args?: unknown,): string {
        return cacheKey(this.config.namespace, module, method, args,);
    }

    private baseFor(req: InternalRequest,): string { return req.rootMounted ? this.config.baseUrl : this.config.apiBase; }

    /** One network call with auth headers + 401-refresh-retry. */
    private async dispatch<T>(req: InternalRequest,): Promise<T> {
        await this.auth.ready;
        const url = joinUrl(this.baseFor(req,), req.path, req.query,);
        const send = async (): Promise<T> => {
            const headers: Record<string, string> = {
                ...this.config.headers, ...(await this.auth.authHeaders(req.method,)),
            };
            if (req.options?.idempotencyKey) headers['Idempotency-Key'] = req.options.idempotencyKey;
            return performRequest<T>({
                fetchImpl: this.config.fetchImpl, method: req.method, url, headers,
                body: req.body, raw: req.raw, timeoutMs: this.config.timeoutMs, signal: req.options?.signal,
            },);
        };
        try { return await send(); }
        catch (err) {
            // One automatic refresh+retry on an expired bearer token.
            if (err instanceof UnauthorizedError && this.config.authMode === 'bearer'
                && this.auth.getTokens() && /expired/i.test(err.message,)) {
                await this.auth.refresh();
                return send();
            }
            throw err;
        }
    }

    /** Module entry point. GET → cached+retry; mutations → network + invalidate. */
    async send<T>(req: InternalRequest,): Promise<T> {
        const retryEnabled = req.options?.retry ?? false;
        const run = () => withRetry(() => this.dispatch<T>(req,), {
            method: req.method, retryEnabled, policy: this.config.retry,
        },);
        try {
            if (req.method === 'GET' && !req.raw) {
                const key = this.cacheKeyFor(req.module, pathMethodKey(req,), req.query ?? null,);
                const ttl = req.options?.ttl ?? this.config.ttl.list;
                return await this.cache.read<T>(key, run, { cache: req.options?.cache, ttl, },);
            }
            const out = await run();
            await this.applyInvalidation(req,);
            return out;
        } catch (err) {
            if (err instanceof CmsError) this.errorBus.emit('error', err,);
            throw err;
        }
    }

    /** Subscribe to live updates for a cached GET (SWR background refresh). */
    subscribe<T>(module: string, method: string, args: unknown, cb: (value: T,) => void,): () => void {
        return this.cache.subscribe<T>(this.cacheKeyFor(module, method, args ?? null,), cb,);
    }

    /** Drop the cached reads for the modules a mutation declares. `invalidates`
     *  entries are bare module names — each drops the WHOLE module's cache. */
    private async applyInvalidation(req: InternalRequest,): Promise<void> {
        const targets = (req as InternalRequest & { invalidates?: string[]; }).invalidates;
        if (!targets) return;
        for (const module of targets) {
            await this.cache.invalidatePrefix(cacheKeyPrefix(this.config.namespace, module,),);
        }
    }

    // ── auth convenience passthroughs ──
    login(c: LoginCredentials & { rememberMe?: boolean; },): Promise<AuthResponse> { return this.auth.login(c,); }
    logout(): Promise<void> { return this.auth.logout(); }
    isAuthenticated(): boolean { return this.auth.isAuthenticated(); }
    setApiKey(key: string,): void { this.auth.setApiKey(key,); }
}

/** Cache method label derived from the route (the GET path without params). */
function pathMethodKey(req: InternalRequest,): string { return req.path; }
