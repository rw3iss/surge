import type { AuthResponse, LoginCredentials, } from '@rw/cms-shared';
import type { AuthMode, AuthTokens, TokenStore, } from '../types';
import { Emitter, } from '../events';
import { performRequest, } from '../request';
import { UnauthorizedError, } from '../errors';

interface AuthManagerOpts {
    mode: AuthMode;
    apiBase: string;
    fetchImpl: typeof fetch;
    apiKey?: string;
    tokens?: AuthTokens;
    store?: TokenStore | null;
}

/** Owns auth state. Decorates each request with the right credential and
 *  runs the single-flight refresh on 401. Auto-loads persisted tokens on
 *  construction so a page refresh restores the session. */
export class AuthManager {
    readonly ready: Promise<void>;
    private mode: AuthMode;
    private apiKey?: string;
    private tokens: AuthTokens | null = null;
    private store?: TokenStore | null;
    private apiBase: string;
    private fetchImpl: typeof fetch;
    private refreshInFlight: Promise<AuthResponse> | null = null;
    private emitter = new Emitter<{ change: AuthTokens | null; expired: void; }>();
    private csrfReady = false;

    constructor(opts: AuthManagerOpts,) {
        this.mode = opts.mode;
        this.apiKey = opts.apiKey;
        this.store = opts.store;
        this.apiBase = opts.apiBase;
        this.fetchImpl = opts.fetchImpl;
        this.ready = this.init(opts.tokens,);
    }

    private async init(initial?: AuthTokens,): Promise<void> {
        if (this.mode !== 'bearer') return;
        if (initial) { this.tokens = initial; await this.store?.save(initial,); return; }
        const loaded = await this.store?.load();
        if (loaded) this.tokens = loaded;
    }

    onChange(cb: (t: AuthTokens | null,) => void,): () => void { return this.emitter.on('change', cb,); }
    onExpired(cb: () => void,): () => void { return this.emitter.on('expired', cb,); }

    isAuthenticated(): boolean { return this.mode === 'apiKey' ? !!this.apiKey : !!this.tokens; }
    getTokens(): AuthTokens | null { return this.tokens; }

    /** Headers to attach to an outgoing request. */
    async authHeaders(method: string,): Promise<Record<string, string>> {
        const h: Record<string, string> = {};
        if (this.mode === 'apiKey' && this.apiKey) h['Authorization'] = `Bearer ${this.apiKey}`;
        else if (this.mode === 'bearer' && this.tokens) h['Authorization'] = `Bearer ${this.tokens.accessToken}`;
        else if (this.mode === 'cookie' && !['GET', 'HEAD', 'OPTIONS',].includes(method,)) {
            const csrf = await this.ensureCsrf();
            if (csrf) h['x-csrf-token'] = csrf;
        }
        return h;
    }

    private getCookie(name: string,): string | null {
        if (typeof document === 'undefined') return null;
        const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`,),);
        return m ? decodeURIComponent(m[1],) : null;
    }

    private async ensureCsrf(): Promise<string | null> {
        let token = this.getCookie('csrf-token',);
        if (!token && !this.csrfReady) {
            try { await this.fetchImpl(`${this.apiBase}/health/live`, { credentials: 'include', },); } catch { /* ignore */ }
            this.csrfReady = true;
            token = this.getCookie('csrf-token',);
        }
        return token;
    }

    async login(credentials: LoginCredentials & { rememberMe?: boolean; },): Promise<AuthResponse> {
        const res = await performRequest<AuthResponse>({
            fetchImpl: this.fetchImpl, method: 'POST', url: `${this.apiBase}/auth/login`,
            headers: {}, body: credentials, timeoutMs: 30_000,
        },);
        await this.setSession(res,);
        return res;
    }

    async refresh(): Promise<AuthResponse> {
        if (this.refreshInFlight) return this.refreshInFlight;
        if (!this.tokens) throw new UnauthorizedError('No refresh token', { code: 'UNAUTHORIZED', status: 401, },);
        this.refreshInFlight = (async () => {
            try {
                const res = await performRequest<AuthResponse>({
                    fetchImpl: this.fetchImpl, method: 'POST', url: `${this.apiBase}/auth/refresh`,
                    headers: {}, body: { refreshToken: this.tokens!.refreshToken, }, timeoutMs: 30_000,
                },);
                await this.setSession(res,);
                return res;
            } catch (err) {
                await this.clearSession();
                this.emitter.emit('expired', undefined,);
                throw err;
            } finally { this.refreshInFlight = null; }
        })();
        return this.refreshInFlight;
    }

    async logout(): Promise<void> {
        try {
            await performRequest({
                fetchImpl: this.fetchImpl, method: 'POST', url: `${this.apiBase}/auth/logout`,
                headers: await this.authHeaders('POST',), timeoutMs: 30_000,
            },);
        } catch { /* best effort */ }
        await this.clearSession();
    }

    setApiKey(key: string,): void { this.mode = 'apiKey'; this.apiKey = key; }

    private async setSession(res: AuthResponse,): Promise<void> {
        this.tokens = { accessToken: res.accessToken, refreshToken: res.refreshToken,
            expiresAt: res.expiresAt as unknown as string, };
        await this.store?.save(this.tokens,);
        this.emitter.emit('change', this.tokens,);
    }

    private async clearSession(): Promise<void> {
        this.tokens = null;
        await this.store?.clear();
        this.emitter.emit('change', null,);
    }
}
