/**
 * Request/response DTOs for the `plugins` module. Conventions: barrel header in
 * ../index.ts. Entity types come from ../../types/plugin.
 */
import type { MarketplacePlugin, Plugin, PublicPlugin, PluginUpdateResult } from '../../types/plugin';

/** Path params for per-plugin routes. */
export interface PluginNameParams {
    name: string;
}

// ── Public (inherent) ──────────────────────────────────────────────────────
/** GET /plugins/enabled — the running site self-loads these. */
export type PluginEnabledListResponse = PublicPlugin[];

// ── Admin reads ─────────────────────────────────────────────────────────────
/** GET /plugins */
export type PluginListResponse = Plugin[];
/** GET /plugins/:name */
export type PluginGetResponse = Plugin;

// ── Admin mutations ───────────────────────────────────────────────────────────
/** POST /plugins/:name/install */
export type PluginInstallResponse = Plugin;

/** PUT /plugins/:name/config */
export interface PluginConfigBody {
    config: Record<string, unknown>;
}
export type PluginConfigResponse = Plugin;

/** POST /plugins/:name/enable | /disable */
export type PluginToggleResponse = Plugin;

/** POST /plugins/:name/update */
export interface PluginUpdateResponse {
    plugin: Plugin;
    result: PluginUpdateResult;
}

/** POST /plugins/:name/uninstall */
export interface PluginUninstallBody {
    confirm: true;
}
export interface PluginUninstallResponse {
    message: string;
    droppedTables: string[];
}

/** POST /plugins/upload (multipart: file=<zip>) */
export type PluginUploadResponse = Plugin;

/** POST /plugins/rescan — re-scan PLUGINS_DIR and reconcile with the DB. */
export type PluginRescanResponse = Plugin[];

// ── Marketplace (stubbed) ─────────────────────────────────────────────────────
/** GET /plugins/marketplace?q= */
export interface PluginMarketplaceQuery {
    q?: string;
}
export type PluginMarketplaceResponse = MarketplacePlugin[];

/** POST /plugins/marketplace/:id/install */
export interface PluginMarketplaceInstallParams {
    id: string;
}
export type PluginMarketplaceInstallResponse = Plugin;
