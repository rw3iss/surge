# PageLoop plugin

Integrates [PageLoop](https://pageloop.dev) (commenting / annotation layer) into
the SiteSurge public site via the Plugin system — the reference plugin.

## How it works

- **`server.js`** — `install()` / `update()` download the PageLoop **vanilla**
  widget bundle (`pageloop.umd.js` + `vanilla.css`) from the CDN into `client/`,
  served same-origin at `/api/v1/plugins/pageloop/assets/*` (so it satisfies the
  admin SPA's `scriptSrc 'self'` CSP). Idempotent.
- **`client.js`** — framework-agnostic:
  - `mountWidget(el, host)` loads the UMD bundle and calls `PageLoop.init()` with
    the saved config. Respects the `adminOnly` gate (the host only mounts it for
    admins when that's set).
  - `mountConfig(el, host)` renders a custom vanilla config page (endpoint,
    project ID, storage mode, public commenting, admin-only, theme, positions)
    with Save + Test-connection — demonstrating the plugin config-page API.

## Configure

Admin → **Plugins → PageLoop**: set the **endpoint** (your PageLoop server) and
**project ID**. Choose **remote** (hosted/self-hosted server) or **local-sqlite**
(a locally-run `pageloop go` server). Toggle **public commenting** and
**admins-only visibility** as needed, then Enable.

> Deficiencies found while building this against PageLoop's current API are
> tracked in [`docs/pageloop-plugin-deficiencies.md`](../../../../docs/pageloop-plugin-deficiencies.md).
