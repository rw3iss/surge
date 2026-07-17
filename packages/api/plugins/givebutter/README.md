# GiveButter plugin

Routes a campaign's donations through [GiveButter](https://givebutter.com) — their
embedded donation widget on the public site + their REST API for campaign
management in the admin — instead of the built-in Stripe flow. Per-campaign: an
admin chooses **Internal (Stripe)** or **GiveButter** for each campaign.

## How it works

- **`server.js`** — a thin GiveButter REST client (`https://api.givebutter.com/v1`,
  `Authorization: Bearer <apiKey>`). Exposes backend **actions** (invoked by the
  admin via `POST /api/v1/plugins/givebutter/action/:action`):
  `testConnection`, `listCampaigns`, `getCampaign`, `createCampaign`,
  `updateCampaign`, `deleteCampaign`, `checkCampaign`. Every action returns a
  normalized `{ ok, ... }` / `{ ok:false, status, error }` envelope so the UI can
  detect a missing/broken campaign. The secret `apiKey` never reaches the browser.
- **`client.js`** — `mountConfig(el, host)`: a vanilla config page (API key,
  Account ID, base URL, default widget) with **Save**, **Test connection**, and
  **List campaigns**. There is no `mountWidget` — the donation widget is rendered
  by the CMS campaign UI (core, gated on this plugin being enabled).
- **Donation widget** — the public campaign page/block loads
  `https://widgets.givebutter.com/latest.umd.cjs?acct=<accountId>` and renders
  `<givebutter-giving-form campaign="<code>">`. Donations go straight to
  GiveButter; our Stripe path is bypassed for GiveButter campaigns.

## Configure

Admin → **Plugins → GiveButter**: set the **API key** (GiveButter → Settings →
API) and **Widget Account ID** (GiveButter → Settings → Integrations → Widgets),
then Enable. On each **Campaign** editor a *Donations* panel appears: pick
**GiveButter** as the provider, then **link** an existing GiveButter campaign
(loaded via the API, or by pasting its 6-char code) or **create** a new one on
save. A warning shows if a campaign is set to GiveButter but not yet linked.

## Notes / future work

- Raised totals shown come from GiveButter's own widget; our
  `current_amount_cents`/`donorCount` are not updated for GiveButter campaigns.
  Syncing totals back via GiveButter **webhooks** is future work.
- `deleteCampaign` exists as an action but is intentionally not wired to a
  destructive admin button in v1.
