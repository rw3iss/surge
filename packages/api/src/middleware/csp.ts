/**
 * Plugin-aware Content-Security-Policy.
 *
 * The base CSP (same directives helmet applied before) is extended at
 * runtime with origins that ENABLED plugins need — chiefly `connect-src`
 * for a widget that talks to its own backend (e.g. PageLoop → its RPC
 * endpoint). Extra origins come from two sources, computed by the plugins
 * service and pushed here via `setPluginCspOrigins`:
 *   1. `type:'url'` config values of enabled plugins → connect-src.
 *   2. A plugin manifest's optional `csp` block (static origins).
 *
 * We wrap helmet's CSP middleware and rebuild it when the plugin origin
 * set changes, so helmet still supplies its secure defaults (base-uri,
 * object-src 'none', frame-ancestors, upgrade-insecure-requests, …).
 */
import helmet from 'helmet';
import type { RequestHandler } from 'express';

export interface PluginCspOrigins {
    connectSrc: string[];
    scriptSrc: string[];
    styleSrc: string[];
    imgSrc: string[];
    frameSrc: string[];
}

const EMPTY: PluginCspOrigins = { connectSrc: [], scriptSrc: [], styleSrc: [], imgSrc: [], frameSrc: [] };

let pluginOrigins: PluginCspOrigins = EMPTY;

function buildDirectives(): Record<string, string[]> {
    return {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", ...pluginOrigins.styleSrc],
        scriptSrc: ["'self'", ...pluginOrigins.scriptSrc],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:', ...pluginOrigins.imgSrc],
        connectSrc: ["'self'", 'https://api.stripe.com', ...pluginOrigins.connectSrc],
        frameSrc: ["'self'", 'https://js.stripe.com', ...pluginOrigins.frameSrc],
    };
}

// The current helmet CSP instance; rebuilt when plugin origins change.
let cspMiddleware: RequestHandler = helmet.contentSecurityPolicy({ directives: buildDirectives() });

/** Replace the plugin-contributed CSP origins and rebuild the middleware. */
export function setPluginCspOrigins(origins: Partial<PluginCspOrigins>): void {
    pluginOrigins = {
        connectSrc: dedupe(origins.connectSrc),
        scriptSrc: dedupe(origins.scriptSrc),
        styleSrc: dedupe(origins.styleSrc),
        imgSrc: dedupe(origins.imgSrc),
        frameSrc: dedupe(origins.frameSrc),
    };
    cspMiddleware = helmet.contentSecurityPolicy({ directives: buildDirectives() });
}

function dedupe(v?: string[]): string[] {
    return v ? [...new Set(v.filter(Boolean))] : [];
}

/** Delegates to the current (rebuildable) helmet CSP middleware. */
export const pluginAwareCsp: RequestHandler = (req, res, next) => cspMiddleware(req, res, next);
