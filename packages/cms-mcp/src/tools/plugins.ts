/**
 * Plugin tools — install / configure / enable / disable / update / uninstall
 * external plugins, plus marketplace search. All management actions are `write`
 * (they run through the admin-scoped API key); reads are read-only.
 */
import { z, } from 'zod';
import { defineTool, type ToolContext, type ToolDef, } from '../tool';

const nameShape = { name: z.string().describe('Plugin name (its folder id).'), };

const tools = [
    defineTool({
        name: 'list_plugins',
        description:
            'List installed/discovered plugins. Each has version, installed/enabled status, source, updateAvailable, and current config.',
        handler: async (_args, ctx: ToolContext,) => ctx.cms.plugins.list(),
    }),
    defineTool({
        name: 'get_plugin',
        description:
            'Get one plugin by name — detail, current config, and manifest (including its configSchema fields to configure).',
        inputSchema: nameShape,
        handler: async (args, ctx: ToolContext,) => ctx.cms.plugins.getByName(args.name,),
    }),
    defineTool({
        name: 'rescan_plugins',
        description:
            'Re-scan the plugins directory and reconcile with the database (picks up manually-added plugin folders).',
        write: true,
        handler: async (_args, ctx: ToolContext,) => ctx.cms.plugins.rescan(),
    }),
    defineTool({
        name: 'install_plugin',
        description:
            'Run a plugin\'s install() hook (create its tables/data, download deps). Idempotent + self-detecting.',
        write: true,
        inputSchema: nameShape,
        handler: async (args, ctx: ToolContext,) => ctx.cms.plugins.install(args.name,),
    }),
    defineTool({
        name: 'configure_plugin',
        description:
            'Merge-save a plugin\'s configuration. Provide `config` with keys from the plugin\'s configSchema (see get_plugin).',
        write: true,
        inputSchema: {
            name: z.string(),
            config: z.record(z.string(), z.unknown(),).describe('Config keys → values to merge into the saved config.',),
        },
        handler: async (args, ctx: ToolContext,) =>
            ctx.cms.plugins.saveConfig(args.name, args.config as Record<string, unknown>,),
    }),
    defineTool({
        name: 'enable_plugin',
        description: 'Enable a plugin (it must be installed first).',
        write: true,
        inputSchema: nameShape,
        handler: async (args, ctx: ToolContext,) => ctx.cms.plugins.enable(args.name,),
    }),
    defineTool({
        name: 'disable_plugin',
        description: 'Disable a plugin (its data is preserved).',
        write: true,
        inputSchema: nameShape,
        handler: async (args, ctx: ToolContext,) => ctx.cms.plugins.disable(args.name,),
    }),
    defineTool({
        name: 'update_plugin',
        description: 'Run a plugin\'s update() hook to upgrade its code/data to the version on disk.',
        write: true,
        inputSchema: nameShape,
        handler: async (args, ctx: ToolContext,) => ctx.cms.plugins.update(args.name,),
    }),
    defineTool({
        name: 'uninstall_plugin',
        description: 'Uninstall a plugin: run uninstall(), drop its owned tables, and remove its folder. Destructive.',
        write: true,
        inputSchema: nameShape,
        handler: async (args, ctx: ToolContext,) => ctx.cms.plugins.uninstall(args.name,),
    }),
    defineTool({
        name: 'search_plugin_marketplace',
        description: 'Search the plugin marketplace (stubbed catalog in v1).',
        inputSchema: { q: z.string().optional().describe('Search text.'), },
        handler: async (args, ctx: ToolContext,) =>
            ctx.cms.plugins.marketplaceSearch(args.q ? { q: args.q, } : undefined,),
    }),
];

export const pluginTools: ToolDef[] = tools as unknown as ToolDef[];
