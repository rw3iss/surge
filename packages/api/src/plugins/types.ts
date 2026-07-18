/**
 * Server-side plugin contracts. A plugin's `server.js` (CommonJS) default-
 * exports a PluginServerModule; every hook is optional, idempotent, and must
 * self-detect prior state so re-running install()/update() never corrupts data.
 */
import type { PluginUpdateResult } from '@sitesurge/types';

export interface PluginLogger {
    info(msg: string, meta?: unknown): void;
    warn(msg: string, meta?: unknown): void;
    error(msg: string, meta?: unknown): void;
}

/** Scoped DB helper handed to plugin hooks. Owned tables are `plugin_<name>_*`. */
export interface PluginDb {
    /** Raw SQL against the shared pool (plugins are trusted). Use tableName() for owned tables. */
    query<T = Record<string, unknown>>(
        sql: string,
        params?: unknown[],
    ): Promise<{ rows: T[]; rowCount: number }>;
    /** Namespaced table identifier: `plugin_<name>_<suffix>`. */
    tableName(suffix: string): string;
    /** Apply this plugin's `migrations/*.sql`, ledgered in `plugin_migrations`. Idempotent. */
    migrate(): Promise<string[]>;
}

/** File helper handed to plugin hooks — reads/writes under the plugin dir + a data dir. */
export interface PluginStorage {
    /** Absolute plugin directory. */
    dir: string;
    /** Absolute writable data directory for this plugin. */
    dataDir: string;
    exists(rel: string): boolean;
    read(rel: string): Promise<string>;
    write(rel: string, content: string | Buffer): Promise<void>;
    /** Download a URL to a file (relative to the plugin dir). Skips if present unless `force`. */
    download(url: string, rel: string, opts?: { force?: boolean }): Promise<void>;
}

/** Options for `ctx.httpJson`. `jsonBody` is JSON-stringified with a
 *  `Content-Type: application/json` header; use `body` for raw payloads. */
export interface PluginHttpJsonOptions {
    method?: string;
    headers?: Record<string, string>;
    jsonBody?: unknown;
    /** Raw request body (already-serialized). Prefer `jsonBody` for JSON. */
    body?: string;
}

/** Normalized result of `ctx.httpJson` — never throws. `data` is the parsed
 *  JSON body (null on 204). On failure, `error` is a human-readable message and
 *  `details` carries the parsed error body when present. */
export type PluginHttpJsonResult =
    | { ok: true; status: number; data: unknown }
    | { ok: false; status: number; error: string; details?: unknown };

export interface PluginServerContext {
    name: string;
    /** Absolute plugin dir. */
    dir: string;
    /** Manifest version on disk. */
    version: string;
    /** Version the last successful install/update ran for (null = not yet installed). */
    installedVersion: string | null;
    /** Current saved config. */
    config: Record<string, unknown>;
    db: PluginDb;
    storage: PluginStorage;
    logger: PluginLogger;
    /** node fetch, for downloading deps/code. */
    http: typeof fetch;
    /** JSON HTTP with a normalized `{ ok, status, data } | { ok:false, status, error }`
     *  envelope — never throws. The sanctioned way for a plugin to call a
     *  third-party JSON/GraphQL API without re-implementing fetch+error handling
     *  (used by the GiveButter/Shopify plugins). */
    httpJson(url: string, opts?: PluginHttpJsonOptions): Promise<PluginHttpJsonResult>;
}

export interface PluginServerModule {
    /** First-time setup: download deps, create tables/data. Idempotent + self-detecting. */
    install?(ctx: PluginServerContext): Promise<void>;
    /** Remove owned tables/data. Idempotent. */
    uninstall?(ctx: PluginServerContext): Promise<void>;
    /** Run when the plugin is toggled on. */
    onEnable?(ctx: PluginServerContext): Promise<void>;
    /** Run when the plugin is toggled off. */
    onDisable?(ctx: PluginServerContext): Promise<void>;
    /** Run on every server boot for ENABLED plugins (register crons, warm caches). */
    onLoad?(ctx: PluginServerContext): Promise<void>;
    /** Upgrade code + migrate data, re-init as needed. Idempotent; reports what changed. */
    update?(ctx: PluginServerContext): Promise<PluginUpdateResult>;
    /** Optional config validation, called before persisting. */
    validateConfig?(config: Record<string, unknown>): { ok: boolean; errors?: Record<string, string> };
    /** Named backend operations a plugin exposes to the admin via
     *  POST /plugins/:name/action/:action. Each receives the plugin ctx + the
     *  request payload and returns JSON. Keep them idempotent + defensive so a
     *  bad payload or a failing upstream API surfaces cleanly, not as a crash. */
    actions?: Record<
        string,
        (ctx: PluginServerContext, payload: Record<string, unknown>) => Promise<unknown>
    >;
}
