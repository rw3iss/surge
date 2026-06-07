# Improvement Audit — 2026-05-17

Focus: **interface styling and responsiveness** (per `/improve` invocation).

## 1. Summary

- Project: SiteSurge CMS (`rw-cms`)
- Working directory: `/home/rw3iss/Sites/rw/rw-cms`
- Total findings: **18** (UI/styling: 9, responsiveness: 6, architecture: 3)
- Scope: SCSS partials + page styles + selected admin components

The project already has a solid token system (`frontend/src/styles/variables.scss`), a documented partial split (`ADMIN_STYLES.md`), and shared CSS custom properties for both site and admin (`--site-*`, `--admin-*`). The gaps are not architectural — they're enforcement: drift back into hardcoded values, duplicated overlay constants, and a handful of public pages + admin partials with zero responsive rules.

## 2. UI & Styling findings

### 2.1 Duplicate `.confirm-modal` styles diverged from canonical version — **medium**
- **Where:** `frontend/src/components/admin/common/ConfirmModal.scss` (40 lines)
- **Problem:** Defines `.confirm-modal-overlay` and `.confirm-modal` with hardcoded values (`#666`, `8px`, `24px`, `0 8px 32px rgba(0, 0, 0, 0.2)`). A second, token-driven copy lives at `frontend/src/styles/shared/_modals.scss`. Whichever CSS loads second wins — currently both load.
- **Fix:** Normalize `ConfirmModal.scss` to use the same tokens as `_modals.scss` so the two are byte-equivalent. (Deletion would be lower risk only after confirming load order; keeping it idempotent is safer.)
- **Risk:** Low (Phase A — visual output unchanged).

### 2.2 `rgba(0, 0, 0, 0.5)` modal backdrop duplicated 6+ times — **medium**
- **Where:** `_admin-shell.scss:98`, `_modals.scss:15`, `ConfirmModal.scss:7`, `MediaUploadModal.scss:4`, `MediaSelectModal.scss:5`, `_dashboard.scss:421`, `PostListBlock.scss:132`
- **Problem:** The same opacity value is sprinkled across overlays. Future tweaks (e.g. raising contrast for high-contrast mode) require touching every file.
- **Fix:** Add `$modal-overlay-bg: rgba(0, 0, 0, 0.5);` + `--modal-overlay-bg` CSS custom property in `variables.scss`. Reference it from each overlay.
- **Risk:** Low.

### 2.3 Hardcoded grays/whites in component SCSS — **low/medium**
- **Where:**
  - `ConfirmModal.scss:30` — `color: #666;`
  - `BlockStyleEditor.scss:21,31` — `color: #999; color: #aaa;`
  - `_admin-shell.scss:62` — `padding: 10px;` (raw px)
  - `_admin-shell.scss:67` — `gap: 5px;` (raw px)
  - `_admin-shell.scss:261` — `font-size: 11px;` (raw px)
- **Problem:** Tokens already exist for every one of these (`$text-light`, `$spacing-sm`, `$font-size-xs`).
- **Fix:** Replace literals with tokens.
- **Risk:** Low.

### 2.4 Missing micro-spacing tokens — **low**
- **Where:** Many partials use `gap: 2px`, `padding: 4px 6px`, `padding: 6px 10px` (forms.scss, ColorPicker, FontManagerPanel, FlyoutPanel).
- **Problem:** `$spacing-xs` is 4px, the next step down is unnamed. Repeated micro values have no token home.
- **Fix:** Add `$spacing-2xs: 2px;` to `variables.scss`. Keep changes opt-in — no mass rewrite this pass.
- **Risk:** Low (additive).

### 2.5 Patreon brand color hardcoded — **low (intentional)**
- **Where:** `Login.scss:52,56` — `background: #f96854;`
- **Verdict:** This is a real brand color, not a theme color. Leaving it as a literal is correct; just add a tiny comment noting it's a brand color so future passes don't try to tokenize it.
- **Risk:** None.

### 2.6 Non-standard breakpoint syntax in admin shell — **low**
- **Where:** `_admin-shell.scss:343,455` — `@media (max-width: 768px)`
- **Problem:** Project convention (per `ADMIN_STYLES.md`) is `@include mobile-only`. Two different syntaxes for the same breakpoint makes it harder to find responsive rules with grep.
- **Fix:** Replace with `@include mobile-only`. Identical CSS output.
- **Risk:** Low.

### 2.7 Heavy inline `style={{}}` in TSX — **medium**
- **Where:** Settings.tsx (35 instances), FormSubmissions.tsx (26), MessageView.tsx (15), BlockRenderer.tsx (14), DatabaseSection.tsx (9).
- **Problem:** Each is a small leak from a partial that should own it. Hot path for inconsistency.
- **Fix (this pass):** Inventory and document. Migration is per-file work (Phase C — too many call sites to flip safely in one pass without per-file design review).
- **Risk:** Medium-high for whole-file migration. Defer.

### 2.8 Hardcoded sidebar width — **low**
- **Where:** `_admin-shell.scss:103` `width: 200px;`, line 290 `margin-left: 200px;`, line 305 `$collapsed-width: 56px;`
- **Problem:** Sidebar widths repeated in three places (one local var, two literals).
- **Fix:** Add `$admin-sidebar-width: 200px;` as a sibling of `$collapsed-width`. Replace literals.
- **Risk:** Low.

### 2.9 Inline-style scrollbar/etc patterns repeated — **low**
- **Where:** Various editor previews use `style={{ color: '#888' }}` patterns despite `.form-help-muted` existing.
- **Fix:** Already partially solved (see `global.scss:478`). Defer remaining migration to per-component pass.

## 3. Responsiveness findings

### 3.1 Public pages missing mobile breakpoints — **medium**
- **Where:** `Login.scss`, `Post.scss`, `Campaign.scss`, `Join.scss`, `Donate.scss`, `Shop.scss` — **zero** `@include sm/md/lg/mobile-only` or raw `@media` rules.
- **Problem:** These rely entirely on percentages + max-widths. Mostly OK, but `Post.scss .post-block__link-card` is a `display: flex` with a fixed `width: 160px` image — on a 360px viewport that leaves ~180px for text, with a stacked link card. Login.scss has comfortable internal padding (`$spacing-lg $spacing-xl`) that should reduce on small phones.
- **Fix:** Add `@include mobile-only` rules to:
  - `Login.scss` — reduce container padding to `$spacing-lg $spacing-md`
  - `Post.scss` — stack `.post-block__link-card` to column on mobile, image becomes full-width
  - `Campaign.scss`, `Join.scss`, `Donate.scss`, `Shop.scss` — gutter + heading-size adjustments
- **Risk:** Low to medium. Add-only rules, won't regress desktop.

### 3.2 Admin block editor has no responsive rules — **high (deferred)**
- **Where:** `_block-editor.scss` (1382 lines), `_inline-editors.scss` (540 lines)
- **Problem:** Touchscreen tablet admins get a desktop-only layout. Editor toolbars, split panes, group blocks stay horizontal.
- **Fix:** Needs design judgment — what should stack? what should overflow-scroll? what should be hidden behind a drawer? This belongs in Phase C as a planning effort, not a blind add of `flex-direction: column`.
- **Risk:** High if applied without design pass.

### 3.3 Admin filter bar wraps but doesn't collapse — **low**
- **Where:** `_admin-shell.scss:575-598`
- **Problem:** `.admin-filter-bar` uses `flex-wrap: wrap` which is fine, but `__search` has `min-width: 200px` and `max-width: 400px`. On phones, wrap leaves orphan controls.
- **Fix:** At `mobile-only`, make the bar `flex-direction: column` and `__search` full-width.
- **Risk:** Low.

### 3.4 Admin `.admin-form` padding is heavy on mobile — **low**
- **Where:** `_admin-shell.scss:567` `padding: $spacing-xl;`
- **Problem:** 32px padding on small screens wastes already-tight horizontal space. The existing mobile media query at line 386 already reduces it to `$spacing-md` — confirm coverage and keep.
- **Verdict:** Already handled. No-op.

### 3.5 Hamburger button positioning on tall content — **low**
- **Where:** `_admin-shell.scss:53-92`
- **Problem:** `position: fixed; top: 16px; left: 16px;` overlaps page H1 on edit pages with sticky save bars. Not a regression — pre-existing — but worth flagging.
- **Fix:** Defer. Needs design judgment on whether the hamburger should anchor to a top bar instead.

### 3.6 Admin tables use `overflow-x: auto` (good) but no row-collapse alternative — **low**
- **Where:** `_admin-shell.scss:390-393`, `:496` `.admin-table-container`
- **Problem:** Horizontal scroll on phones works but feels clumsy on dense tables (Users, Pages). Acceptable for v1; revisit when a `<List>`-style row component lands.
- **Verdict:** Defer.

## 4. Architecture findings

### 4.1 `_block-editor.scss` is 1382 lines — **high (Phase C)**
- Adding mobile rules without first slicing this file will compound the maintainability problem. Worth a focused refactor pass.

### 4.2 `ConfirmModal.scss` should ultimately go away — **medium (Phase B candidate)**
- Once normalized (2.1), the next step is to remove the `import './ConfirmModal.scss'` line and let `_modals.scss` carry it. Verify nothing else relies on the duplicate file being present, then delete.
- Defer to a follow-up so the audit pass isn't blocked on grep-and-pray.

### 4.3 No theme-token coverage check — **low (Phase C)**
- There's no script that fails CI when a new `#hhhhhh` literal lands. A `npm run lint:styles` rule that bans hex literals outside `variables.scss` would lock the gains in.

## 5. Recommended execution plan

### Phase A — apply automatically (low risk)
1. Add `$spacing-2xs`, `$admin-sidebar-width`, `$modal-overlay-bg` tokens to `variables.scss`. Add `--modal-overlay-bg` CSS custom property to `global.scss` `:root` (via `Layout` or `global.scss`).
2. Normalize `ConfirmModal.scss` to use tokens — output matches `_modals.scss`.
3. Replace hardcoded `rgba(0, 0, 0, 0.5)` modal backdrops with the new token across the 6 affected files.
4. Replace literal grays/whites in `ConfirmModal.scss`, `BlockStyleEditor.scss` with tokens (`$text-light`, `$text-color`).
5. Replace raw `padding: 10px`, `gap: 5px`, `font-size: 11px` in `_admin-shell.scss` with `$spacing-sm`, `$spacing-xs`/`$spacing-2xs`, `$font-size-xs`.
6. Replace sidebar `200px` literals with `$admin-sidebar-width`.
7. Convert `@media (max-width: 768px)` blocks in `_admin-shell.scss` to `@include mobile-only`.

### Phase B — apply after approval (medium risk, **user pre-approved with "implement all phases"**)
1. Add `@include mobile-only` rules to `Login.scss` — reduce container padding.
2. Add `@include mobile-only` rules to `Post.scss` — stack `.post-block__link-card` to column, full-width image.
3. Add `@include mobile-only` rules to `Campaign.scss`, `Join.scss`, `Donate.scss`, `Shop.scss` — gutter / heading-size tweaks.
4. Add `@include mobile-only` collapse to `.admin-filter-bar` (column + full-width search).
5. Patreon brand color comment in `Login.scss`.

### Phase C — plan only (high risk / multi-pass refactors)
1. Slice `_block-editor.scss` (1382 lines) into per-concern partials (group recursion, content-block hover bar, add-block menu, type-specific blocks). Only then add responsive rules.
2. Migrate inline `style={{}}` from `Settings.tsx`, `FormSubmissions.tsx`, `MessageView.tsx`, `BlockRenderer.tsx` to `_settings.scss` / `_forms.scss` / `BlockRenderer.scss`. One file at a time, with screenshot diffs.
3. Drop `ConfirmModal.scss` entirely once 2.1 confirms output parity.
4. Add a stylelint rule banning hex literals outside `variables.scss`.
5. Establish a complete dark-mode story (today some admin tokens have dark fallbacks, public site doesn't).

---

## Execution log

### Phase A — applied

| # | Change | Files |
|---|---|---|
| A1 | Added `$spacing-2xs`, `$admin-sidebar-width`, `$admin-sidebar-collapsed-width`, `$modal-overlay-bg` tokens | `frontend/src/styles/variables.scss` |
| A2 | Exposed `--modal-overlay-bg` CSS custom property | `frontend/src/styles/global.scss` |
| A3 | Normalised `ConfirmModal.scss` to use tokens (output parity with `_modals.scss`) | `frontend/src/components/admin/common/ConfirmModal.scss` |
| A4 | Migrated 6 modal overlay backdrops to `var(--modal-overlay-bg, …)` | `_modals.scss`, `MediaUploadModal.scss`, `MediaSelectModal.scss`, `PostListBlock.scss`, `_dashboard.scss` (global-search), `_media.scss` (media-picker), `_inline-editors.scss` (social-post-modal), `_admin-shell.scss` (layout overlay) |
| A5 | Replaced literal grays `#999`/`#aaa` with `$text-light` | `BlockStyleEditor.scss` |
| A6 | Replaced literal `10px`/`5px`/`2px` with `$spacing-sm`/`$spacing-xs`/`$spacing-2xs` in hamburger button | `_admin-shell.scss` |
| A7 | Replaced sidebar `200px` literals with `$admin-sidebar-width`; replaced local `$collapsed-width: 56px` with shared `$admin-sidebar-collapsed-width` | `_admin-shell.scss` |
| A8 | Converted `@media (max-width: 768px)` blocks to `@include mobile-only` (2 occurrences) | `_admin-shell.scss` |

**Verification:** `npm run build:frontend` → ✓ built in 4.57s, no errors.

### Phase B — applied (user pre-approved with "implement all phases")

| # | Change | Files |
|---|---|---|
| B1 | `@include mobile-only` padding tweak on `.login__container` (24px/32px → 24px/16px) | `Login.scss` |
| B2 | Added brand-color comment on `#f96854` Patreon literal | `Login.scss`, `Join.scss` |
| B3 | `@include mobile-only` padding tweak on `.join__section` | `Join.scss` |
| B4 | Stacked `.post-block__link-card` to column on mobile (image full-width with 16:9 aspect) | `Post.scss` |
| B5 | Mobile padding + title size + tracker tweaks on `.campaign-page` | `Campaign.scss` |
| B6 | Mobile padding + header sizing on `.donate-page` | `Donate.scss` |
| B7 | Mobile padding + header sizing on `.shop-page` | `Shop.scss` |
| B8 | `.admin-filter-bar` collapses to column at `mobile-only` (search + selects go full-width) | `_admin-shell.scss` |

**Verification:** `npm run build:frontend` → ✓ built in 4.55s, no errors.

### Phase C — deferred per command rules

These items remain documented above (sections 2.7, 3.2, 4.1–4.3). They require either design judgment, multi-file refactors, or new dependencies and should be tackled via dedicated planning sessions (`/implement` or `superpowers:writing-plans`):

- Slice `_block-editor.scss` (1382 lines) into per-concern partials, then add responsive rules.
- Migrate inline `style={{}}` from `Settings.tsx`, `FormSubmissions.tsx`, `MessageView.tsx`, `BlockRenderer.tsx` to partials.
- Delete `ConfirmModal.scss` once import is dropped and parity confirmed.
- Add a stylelint rule banning hex literals outside `variables.scss`.
- Establish a complete dark-mode story (today only admin has dark fallbacks).

### Docs sync

- This audit doc itself: created at `docs/improvement-audit-2026-05-17.md`.
- `ADMIN_STYLES.md` already points readers at `variables.scss` as the source of truth for tokens; no per-token enumeration to update. New tokens added there are self-documenting via inline section headers.
- `CLAUDE.md`: no public-API or feature-surface changes from this pass; left untouched.
