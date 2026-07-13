'use strict';
/**
 * PageLoop plugin — server hooks. The install/update hooks DOWNLOAD the PageLoop
 * vanilla widget bundle into this plugin's client/ folder (served same-origin at
 * /api/v1/plugins/pageloop/assets/*), demonstrating a plugin that fetches its own
 * dependencies. All hooks are idempotent + self-detecting.
 */
const PAGELOOP_VERSION = '0.7.1';
const CDN = `https://unpkg.com/@pageloop/vanilla@${PAGELOOP_VERSION}/dist`;

async function ensureBundle(ctx, force) {
    // storage.download skips when the file already exists unless force=true.
    await ctx.storage.download(`${CDN}/pageloop.umd.js`, 'client/pageloop.umd.js', { force });
    await ctx.storage.download(`${CDN}/vanilla.css`, 'client/vanilla.css', { force });
}

module.exports = {
    async install(ctx) {
        ctx.logger.info(`Downloading PageLoop widget bundle v${PAGELOOP_VERSION}…`);
        await ensureBundle(ctx, false);
        ctx.logger.info('PageLoop widget bundle ready.');
    },

    async update(ctx) {
        // Re-fetch the bundle for the pinned version. Config + comments untouched.
        await ensureBundle(ctx, true);
        return {
            fromVersion: ctx.installedVersion || ctx.version,
            toVersion: ctx.version,
            migrated: false,
            notes: `Re-downloaded PageLoop widget bundle v${PAGELOOP_VERSION}.`,
        };
    },

    async onEnable(ctx) { ctx.logger.info('PageLoop enabled.'); },
    async onDisable(ctx) { ctx.logger.info('PageLoop disabled.'); },
    async onLoad() { /* no server-side runtime — the widget talks to the PageLoop endpoint directly */ },
    async uninstall() { /* downloaded bundle is removed with the plugin folder */ },

    validateConfig(config) {
        const errors = {};
        if (config.endpoint && !/^https?:\/\//i.test(String(config.endpoint))) {
            errors.endpoint = 'Must be an http(s) URL';
        }
        return { ok: Object.keys(errors).length === 0, errors };
    },
};
