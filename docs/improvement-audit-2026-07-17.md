# Improvement Audit — 2026-07-17

## 1. Summary
- **Project:** SiteSurge CMS (`@sitesurge/*` monorepo)
- **Working directory:** `/home/rw3iss/Sites/rw/rw-cms`
- **Focus:** DRY, redundancy, dead code, and low-risk consistency wins — emphasis on recently added surfaces (plugins, shop override, GiveButter, banner-layout).
- **Total findings:** 16 (UI/bug: 3, styling/tokens: 4, DRY/architecture: 9)
- **Phase A applied automatically:** 6 change-sets (build + typecheck green).
- **Phase B (needs approval / own pass):** 5. **Phase C (plan separately):** 2.

Method: two parallel sub-audits (frontend; backend + SCSS), every "dead"/"unused" claim grep-verified.

---

## 2. UI & UX (real bugs)

### F1 — Plugins admin renders status badges + error alerts UNSTYLED  ✅ APPLIED
- **Where:** `pages/admin/Plugins.tsx` (34-37, 58, 78, 135, 144), `pages/admin/PluginConfig.tsx` (52, 55, 57, 87), `components/plugins/PluginConfigForm.tsx:60`.
- **Problem:** Bootstrap single-dash classes (`badge-success/-info/-muted/-danger/-warning`, `alert-danger/-warning`) that don't exist in this BEM codebase → bare boxes, no color-coding, on pages you actively use to manage plugins.
- **Fix applied:** Renamed to BEM (`badge--success/--info/--muted/--error/--warning`, `alert--error/--warning`), mapping `danger → error` to match the app's `$error-*` tokens. 12 call sites, 3 files. Verified no other single-dash `alert-`/`badge-` classes remain repo-wide.
- **Risk:** low.

### F2 — GiveButter widget + inline campaign widget render UNSTYLED  ✅ APPLIED
- **Where:** `components/blocks/GiveButterWidget.tsx` (`.gb-widget`, `.gb-widget__missing`), `components/blocks/BlockRenderer.tsx` (`.campaign-block__givebutter`) — no SCSS rule existed for any of them.
- **Fix applied:** New `GiveButterWidget.scss` (centred, max-width 480px, muted "not linked" fallback), imported by the component; added `.campaign-block__givebutter { margin-top }` to `BlockRenderer.scss`.
- **Risk:** low (additive CSS).

### F3 — `AdminListPage` component built but unused while 19 pages hand-roll tables
- **Where:** `components/admin/common/AdminListPage.tsx` (181 lines, zero import sites). Meanwhile `ShopProducts/ShopOrders/Posts/…` hand-roll `admin-table` markup and even hardcode `AdminListPage`'s own `admin-list-page__bulk-bar` CSS class names.
- **Decision:** **Phase C.** Either delete (dead) or adopt across list pages — both are >10-file / judgment calls. Deferred to a dedicated pass.

---

## 3. Styling & design system

### S1 — `.shopify-banner` used 3 literal hex greens  ✅ APPLIED
- **Where:** `pages/admin/styles/_shop.scss` (`#f0fdf4`/`#86efac`/`#14532d`). Violates CLAUDE.md ("no new literal hex — extend variables.scss").
- **Fix applied:** Reuses `$success-bg/-fg/-border` (harmonizes with other success states; themes from one place).
- **Risk:** low (slight shade shift toward the app palette — intentional).

### S2 — `.alert--warning` computed its border inline instead of a token  ✅ APPLIED
- **Where:** `_buttons-badges.scss` used `color.adjust($warning-bg,…)` while `--error`/`--success` use `$*-border` tokens.
- **Fix applied:** Added `$warning-border: #ffeeba` to `variables.scss`; `.alert--warning` now references it (matches its siblings).
- **Risk:** low.

### S3 — `.gb-panel` lives in `_buttons-badges.scss` (wrong partial)
- **Where:** GiveButter Campaign-editor panel styles sit in the generic buttons/badges partial; per `ADMIN_STYLES.md` they belong in an editor/campaign partial.
- **Decision:** **Phase B** (cosmetic move; low risk but touches partial ordering + the styles doc).

### S4 — `.alert` lacks `--info` (asymmetry with `.badge`)
- **Decision:** Skip — no current call site needs `alert--info`; add on demand. Noted only.

---

## 4. Architecture & code quality (DRY / dead code)

### A1 — Duplicated currency/date formatters in the shop admin  ✅ APPLIED
- **Where:** `pages/admin/shop/shopUtils.ts` `formatCents`/`formatDate` re-implemented `Intl.NumberFormat`/`Intl.DateTimeFormat` that `@sitesurge/types` `formatCurrency`/`formatDate` already provide (and that `pages/shop/shopFormat.ts` `money` already re-exports).
- **Fix applied:** Both now delegate to the shared helpers (keeping the null-guards + same signatures, so the 3 admin callers are unchanged). One canonical money/date formatter.
- **Risk:** low (locale harmonized to the shared `en-US`, matching `money` used elsewhere in the same section).

### A2 — Redundant inline styles on `.u-flex-row`  ✅ APPLIED
- **Where:** `pages/admin/PostEditor.tsx` — 6 rows re-specified the class defaults (`align-items:center; gap:8px`) inline, one used a magic `6px`, one wanted `space-between`.
- **Fix applied:** Stripped the inert `align-items/gap` inline objects (3 rows), swapped the space-between row to the existing `.u-flex-between`, replaced the `6px` gap with `.u-gap-xs`, kept the one meaningful `margin-top`.
- **Risk:** low (visually inert / token-nudged).

### A3 — "load plugins + branch on isPluginEnabled" boilerplate repeated
- **Where:** `Campaign.tsx`, `BlockRenderer.tsx` (CampaignBlock), `CampaignEditor.tsx` (GiveButter); `ShopGuard.tsx` ≈ `ShopStoreGuard.tsx` (near-identical guard bodies, only fallback markup differs).
- **Decision:** **Phase B.** Extract `useGiveButterAvailable()` + a shared `<FeatureGuard feature fallback>` the two shop guards render. Behavior-preserving but touches component structure — wants a review.

### A4 — `createResource(async () => { try {…} catch { return default } })` repeated 27× / 26 files
- **Decision:** **Phase B** (its own pass). A `createSafeResource(fetcher, fallback)` helper would collapse all of them, but the 26-file blast radius warrants an isolated change, not folding into this one.

### A5 — Plugin `server.js` share a normalized-fetch envelope; `client.js` share DOM-builder helpers (~53 lines)
- **Where:** `plugins/givebutter/server.js` `gb()` ≈ `plugins/shopify/server.js` `gqlPost()`; all three `client.js` redefine identical `group/input/select/checkbox`.
- **Decision:** **Phase B (optional).** Feasible without a build step (add `ctx.httpJson` to the plugin API; host-serve a shared `config-ui.js` ESM the `client.js`es `import`). Small payoff today (2–3 plugins); worth it before a 4th plugin lands.

### A6 — `posts.repo.ts` `updatePost` hand-rolls a camel→snake field map
- **Where:** 19-entry `fields` map duplicating what `buildUpdateSet` (`utils/mapRow.ts`) already does generically (`campaigns.repo.ts` already delegates).
- **Decision:** **Phase B.** Replace with an allowlist + `buildUpdateSet`, keeping the two real side-effects (content sanitize, `published_at` COALESCE). Low risk but a core write path → wants a test/diff.

### A7 — Confirmed-dead backend exports (grep-verified zero callers)
- `createAdminUser` (`services/auth.ts`) — **duplicated** inline in `setup/adminUserStep.ts`; reconcile rather than delete.
- `adjustInventory` (`services/shop/variants.ts`) — `checkout.ts` decrements inventory inline instead; may be a missing oversell guard, not cruft.
- Pure orphans: `findCategoryById`, `findCollectionById` (`shopCatalog.repo`), `listForList` (`mailSendJobs.repo`), `productsByTag` (`catalog.ts`), `resetTemplate` (`ssr/index.ts`).
- **Decision:** **Phase C / `/dead-code`.** Several look like intended-but-unwired functionality; deleting risks removing behavior. NOT auto-removed. (Also: many other "unused" service exports are the deliberate headless-SDK surface — do NOT delete.)

### A8 — Confirmed-dead frontend exports
- `stores/plugins.ts` `enabledPlugins` re-export; `services/shopifySource.ts` `shopifyDomain` export (used only internally) + `listCollections` method (no callers).
- **Decision:** Kept as coherent API surface / deferred to `/dead-code`. Low value, low risk either way.

### A9 — `?v=` cache-bust only in pageloop `client.js`
- **Finding:** Correct as-is — givebutter/shopify vendor no bundle (givebutter loads GiveButter's CDN `latest.umd.cjs`; shopify is server-side only). Not a DRY gap. Noted: GiveButter's `latest` is unpinned (future hardening item, out of scope).

---

## 5. Execution plan

- **Phase A (applied automatically):** F1, F2, S1, S2, A1, A2 — all green (`tsc --noEmit` clean, admin build ✓).
- **Phase B (recommended next, needs a review/own pass):** S3 (move `.gb-panel`), A3 (`useGiveButterAvailable`/`FeatureGuard`), A4 (`createSafeResource`), A5 (plugin `ctx.httpJson` + shared config-ui), A6 (`updatePost` → `buildUpdateSet`).
- **Phase C (plan separately / `/dead-code`):** F3 (`AdminListPage` adopt-or-delete), A7 (backend dead/unwired exports).

## 6. Docs touched
- `docs/improvement-audit-2026-07-17.md` (this file).
- `packages/cms/src/components/admin/ADMIN_STYLES.md` — noted the new `$warning-border` token + that `_shop.scss` owns `.shopify-banner` (styling doc kept in step).
- No public API / CLI / config surface changed by Phase A → no README/API-doc updates required.
