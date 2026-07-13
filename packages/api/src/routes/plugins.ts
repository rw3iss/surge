/**
 * Plugins module routes. Admin-only except the two inherent public reads the
 * running site uses to self-load widgets: `GET /enabled` and the same-origin
 * client bundle/assets. Mounted feature-gated (`plugins`) — 404 when disabled.
 */
import { z } from 'zod';
import multer from 'multer';
import type {
    PluginConfigBody,
    PluginMarketplaceQuery,
    PluginUninstallBody,
} from '@sitesurge/types';
import { defineRoute, reply } from '../api/defineRoute';
import { AppError } from '../core/errors';
import { config } from '../config';
import * as plugins from '../services/plugins';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.upload.maxSizeMb * 1024 * 1024 },
});

const nameParams = z.object({ name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/) });
const configBody = z.object({ config: z.record(z.string(), z.unknown()) }) satisfies z.ZodType<PluginConfigBody>;
const uninstallBody = z.object({ confirm: z.literal(true) }) satisfies z.ZodType<PluginUninstallBody>;
const marketplaceQuery = z.object({ q: z.string().optional() }) satisfies z.ZodType<PluginMarketplaceQuery>;

export const pluginsRoutes = [
    // ── inherent public ──
    defineRoute({
        method: 'get', path: '/enabled', auth: 'public',
        summary: 'List enabled plugins + client bundle URLs (the running site self-loads these).',
        handler: () => plugins.listEnabledPublic(),
    }),
    defineRoute({
        method: 'get', path: '/:name/client.js', auth: 'public', raw: true,
        summary: 'Serve a plugin\'s browser ESM bundle (same-origin).',
        input: { params: nameParams },
        handler: ({ params, res }) => {
            const p = plugins.clientBundlePath(params.name);
            if (!p) { res.status(404).end(); return; }
            res.type('application/javascript');
            res.sendFile(p);
        },
    }),
    defineRoute({
        method: 'get', path: '/:name/assets/:file', auth: 'public', raw: true,
        summary: 'Serve a plugin static asset from its client/ folder.',
        input: { params: nameParams.extend({ file: z.string() }) },
        handler: ({ params, res }) => {
            const p = plugins.assetPath(params.name, params.file);
            if (!p) { res.status(404).end(); return; }
            res.sendFile(p);
        },
    }),

    // ── admin: reads ──
    defineRoute({
        method: 'get', path: '/', auth: 'admin',
        summary: 'List all installed/discovered plugins (admin table view).',
        handler: () => plugins.list(),
    }),
    defineRoute({
        method: 'get', path: '/marketplace', auth: 'admin',
        summary: 'Search the plugin marketplace (stubbed).',
        input: { query: marketplaceQuery },
        handler: ({ query }) => plugins.marketplaceSearch(query.q),
    }),
    defineRoute({
        method: 'get', path: '/:name', auth: 'admin',
        summary: 'Get one plugin (detail + config + manifest).',
        input: { params: nameParams },
        handler: ({ params }) => plugins.getOne(params.name),
    }),

    // ── admin: mutations ──
    defineRoute({
        method: 'post', path: '/rescan', auth: 'admin',
        summary: 'Re-scan PLUGINS_DIR and reconcile with the DB.',
        handler: ({ audit }) => plugins.rescan().then((r) => { void audit; return r; }),
    }),
    defineRoute({
        method: 'post', path: '/upload', auth: 'admin',
        summary: 'Upload a plugin .zip (unzipped into PLUGINS_DIR, registered disabled).',
        pre: [upload.single('file')],
        handler: async ({ req, audit }) => {
            const file = (req as { file?: { buffer: Buffer } }).file;
            if (!file) throw new AppError(400, 'BAD_REQUEST', 'No file uploaded (field "file")');
            return reply(await plugins.installFromZip(file.buffer, audit()), { status: 201 });
        },
    }),
    defineRoute({
        method: 'post', path: '/marketplace/:id/install', auth: 'admin',
        summary: 'Install a plugin from the marketplace (stubbed).',
        input: { params: z.object({ id: z.string() }) },
        handler: ({ params, audit }) => plugins.marketplaceInstall(params.id, audit()),
    }),
    defineRoute({
        method: 'post', path: '/:name/install', auth: 'admin',
        summary: 'Run the plugin\'s install() hook.',
        input: { params: nameParams },
        handler: ({ params, audit }) => plugins.install(params.name, audit()),
    }),
    defineRoute({
        method: 'put', path: '/:name/config', auth: 'admin',
        summary: 'Save (merge) a plugin\'s config.',
        input: { params: nameParams, body: configBody },
        handler: ({ params, body, audit }) => plugins.saveConfig(params.name, body.config, audit()),
    }),
    defineRoute({
        method: 'post', path: '/:name/enable', auth: 'admin',
        summary: 'Enable a plugin.',
        input: { params: nameParams },
        handler: ({ params, audit }) => plugins.enable(params.name, audit()),
    }),
    defineRoute({
        method: 'post', path: '/:name/disable', auth: 'admin',
        summary: 'Disable a plugin (data preserved).',
        input: { params: nameParams },
        handler: ({ params, audit }) => plugins.disable(params.name, audit()),
    }),
    defineRoute({
        method: 'post', path: '/:name/update', auth: 'admin',
        summary: 'Run the plugin\'s update() hook.',
        input: { params: nameParams },
        handler: ({ params, audit }) => plugins.update(params.name, audit()),
    }),
    defineRoute({
        method: 'post', path: '/:name/uninstall', auth: 'admin',
        summary: 'Uninstall a plugin: run uninstall(), drop owned tables, remove folder.',
        input: { params: nameParams, body: uninstallBody },
        handler: async ({ params, audit }) => {
            const { droppedTables } = await plugins.uninstall(params.name, audit());
            return { message: `Removed ${params.name}`, droppedTables };
        },
    }),
];
