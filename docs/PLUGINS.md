# Plugins

SiteSurge supports **plugins** — admin-installable extensions that live in a
backend `plugins/` directory, modeled on the [Features](../CLAUDE.md) system but
over an open, data-driven set. Design spec:
`docs/superpowers/specs/2026-07-13-plugin-system-design.md`.

Enable the **Plugins** feature (Settings → Features) to reveal **Admin →
Plugins**. Reference plugin: `packages/api/plugins/pageloop/`.

## Anatomy

```
plugins/<name>/
  plugin.json      # manifest (required)
  server.js        # Node lifecycle hooks (CommonJS; optional)
  client.js        # browser ESM bundle: mount/unmount + config UI (optional)
  client/          # static assets served at /api/v1/plugins/<name>/assets/*
  migrations/*.sql # optional plugin-owned SQL (tables prefixed plugin_<name>_*)
```

### `plugin.json`
```jsonc
{
  "name": "pageloop",              // == folder name (kebab, unique)
  "label": "PageLoop Comments",
  "version": "0.1.0",
  "apiVersion": 1,                 // host plugin-API version
  "server": "server.js",
  "client": "client.js",
  "capabilities": ["public-widget", "config-page"],
  "adminOnlyToggle": true,
  "configSchema": [                // host renders a form from this if no custom mountConfig
    { "key": "endpoint", "label": "Server endpoint", "type": "url", "required": true },
    { "key": "adminOnly", "label": "Admins only", "type": "boolean", "default": false }
  ]
}
```
Field types: `string | url | number | boolean | select | secret | textarea`.
`secret` fields are stripped from the public projection.

### `server.js` — Node hooks (all optional, idempotent, self-detecting)
```js
module.exports = {
  async install(ctx)  { /* download deps, create tables/data */ },
  async uninstall(ctx){ /* cleanup (owned tables dropped by the host) */ },
  async onEnable(ctx) {},
  async onDisable(ctx){},
  async onLoad(ctx)   { /* every boot for enabled plugins */ },
  async update(ctx)   { return { fromVersion, toVersion, migrated, notes }; },
  validateConfig(config) { return { ok: true }; },
};
```
`ctx` = `{ name, dir, version, installedVersion, config, db, storage, logger, http }`.
- `ctx.db` — `query(sql,params)`, `tableName(suffix)` → `plugin_<name>_<suffix>`, `migrate()`.
- `ctx.storage` — `dir`, `dataDir`, `read/write/exists`, `download(url, rel, {force})`.
- **Idempotency:** check `ctx.installedVersion` + actual state before acting; never overwrite existing data. `update()` applies only the forward delta.

### `client.js` — framework-agnostic browser module
Default-export; **must not import `solid-js`** (mount via plain DOM):
```js
export default {
  mountWidget(el, host) { /* public-site widget; return teardown */ },
  mountConfig(el, host) { /* admin config page; return teardown */ },
};
```
`host` = `{ name, config, settings, user, isAdmin, saveConfig(patch), api, mountPoint, onCleanup(fn) }`.
Bundles are served **same-origin** (`/api/v1/plugins/<name>/client.js`) and loaded via
dynamic `import()`, so they satisfy the admin SPA's `scriptSrc 'self'` CSP.

## Lifecycle

`discovered → installed → enabled ⇄ disabled → (uninstalled)`. Hooks run in a
transaction with a `pg_advisory_xact_lock('plugin:<name>')`. Enabling the widget
respects the per-plugin `adminOnly` config (mounts only for signed-in admins).

## Install paths

- **Manual:** drop a folder into `plugins/`, then Admin → Plugins → **Rescan**.
- **Upload:** Admin → Plugins → **Upload .zip** (path-traversal guarded; registered disabled).
- **Marketplace:** stubbed search in v1; install throws a clear "not yet available".

## API + SDK + MCP

- Routes under `/api/v1/plugins` — **admin-only** except `GET /plugins/enabled`
  and the `client.js`/`assets` reads (public, so the site self-loads widgets).
  Mounted feature-gated (`plugins`) → 404 when disabled.
- SDK/client: `cms.plugins.*` (`list`, `getByName`, `install`, `saveConfig`,
  `enable`, `disable`, `update`, `uninstall`, `upload`, `rescan`, `marketplaceSearch`).
- MCP: `list_plugins`, `get_plugin`, `install_plugin`, `configure_plugin`,
  `enable_plugin`, `disable_plugin`, `update_plugin`, `uninstall_plugin`,
  `rescan_plugins`, `search_plugin_marketplace` (all mutations `write`).

## Where plugins live + config

`PLUGINS_DIR` (env, default `./plugins` from cwd) — in the **consumer project**
so plugins survive `@sitesurge/server` npm upgrades. In the monorepo it resolves
to `packages/api/plugins/`.

## Security (v1)

Plugin backend code runs **trusted, in-process** (WordPress-style; not sandboxed).
Mitigations: admin-only management, zip path-traversal/symlink guards, plugin DB
access scoped to `plugin_<name>_*`, same-origin-only client bundles, per-plugin
boot error isolation. Worker/VM sandboxing + signed marketplace bundles are future work.
