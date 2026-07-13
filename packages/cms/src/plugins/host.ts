/**
 * Client-side plugin host contract. Plugins are FRAMEWORK-AGNOSTIC: their
 * browser bundle default-exports `{ mountWidget?, mountConfig? }` and mounts
 * into a plain DOM element, receiving a host context object. This keeps plugins
 * isolated from the host's Solid runtime/context singleton (and portable if the
 * CMS ever moves off SolidJS).
 */
import type { PublicPlugin } from '@sitesurge/types';

export interface PluginHost {
    name: string;
    /** Current plugin config (public subset for widgets; full for config pages). */
    config: Record<string, unknown>;
    /** Public site settings snapshot. */
    settings: Record<string, unknown>;
    user: { id: string; role: string } | null;
    isAdmin: boolean;
    /** Persist a config patch (admin config pages only; no-op for public widgets). */
    saveConfig(patch: Record<string, unknown>): Promise<void>;
    /** Scoped fetch to this plugin's backend routes (/api/v1/plugins/:name/*). */
    api: {
        get(path: string): Promise<unknown>;
        post(path: string, body?: unknown): Promise<unknown>;
    };
    /** The element the plugin renders into. */
    mountPoint: HTMLElement;
    /** Register teardown; the host calls these on unmount. */
    onCleanup(fn: () => void): void;
}

/** A plugin's browser module (default export). */
export interface PluginClientModule {
    mountWidget?(el: HTMLElement, host: PluginHost): void | (() => void);
    mountConfig?(el: HTMLElement, host: PluginHost): void | (() => void);
}

const moduleCache = new Map<string, Promise<PluginClientModule>>();

/**
 * Dynamically import a plugin's ESM bundle. Same-origin (served by the backend
 * at /api/v1/plugins/:name/client.js) so it satisfies the `scriptSrc 'self'`
 * CSP. `@vite-ignore` keeps the bundler from trying to resolve it at build time.
 */
export function loadPluginModule(clientUrl: string): Promise<PluginClientModule> {
    let p = moduleCache.get(clientUrl);
    if (!p) {
        p = import(/* @vite-ignore */ clientUrl).then(
            (m) => ((m as { default?: PluginClientModule }).default ?? m) as PluginClientModule,
        );
        moduleCache.set(clientUrl, p);
    }
    return p;
}

/** Build a PluginHost around a mounted plugin. */
export function buildHost(opts: {
    name: string;
    config: Record<string, unknown>;
    settings: Record<string, unknown>;
    user: { id: string; role: string } | null;
    isAdmin: boolean;
    mountPoint: HTMLElement;
    cleanups: Array<() => void>;
    saveConfig?: (patch: Record<string, unknown>) => Promise<void>;
}): PluginHost {
    const base = `/api/v1/plugins/${opts.name}`;
    const call = async (method: string, path: string, body?: unknown): Promise<unknown> => {
        const res = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
            method,
            credentials: 'include',
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
        });
        const json = await res.json().catch(() => ({}));
        return (json as { data?: unknown }).data ?? json;
    };
    return {
        name: opts.name,
        config: opts.config,
        settings: opts.settings,
        user: opts.user,
        isAdmin: opts.isAdmin,
        mountPoint: opts.mountPoint,
        saveConfig: opts.saveConfig ?? (async () => { /* read-only host */ }),
        api: {
            get: (path) => call('GET', path),
            post: (path, b) => call('POST', path, b),
        },
        onCleanup: (fn) => opts.cleanups.push(fn),
    };
}

export type { PublicPlugin };
