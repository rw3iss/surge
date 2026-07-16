# Improvement Audit — 2026-07-15

## 1. Summary
- **Project:** SiteSurge CMS (`surge-cms`) monorepo
- **Working directory:** `/home/rw3iss/Sites/rw/rw-cms`
- **Total findings:** 37 (UI: 6, styling: 8, architecture: 23)
- **Method:** three parallel read-only audits (frontend UI/styling, frontend architecture/DRY, backend architecture/DRY).
- **Two latent bugs found** (not just cleanliness): **F1** (post blocks never get UUIDs) and **F7** (post editor drops `styleRef` on save → block styles silently don't persist).

Note: the working tree already carried this session's block-editor / carousel changes before this audit; improvement edits stack on top, left uncommitted for review.

---

## 2. UI & UX improvements

| ID | Title | Location | Problem | Fix | Risk |
|----|-------|----------|---------|-----|------|
| U1 | Dead duplicate `Toggle` | `components/ui/Toggle.tsx` vs `components/admin/common/Toggle.tsx` | Two switch impls, divergent ARIA; `ui/Toggle` imported nowhere | Delete dead `ui/Toggle` (+scss); standardize on `common/Toggle` (port `role="switch"`) | low |
| U2 | Modal-overlay pattern reimplemented inline | ColorPicker, BlockEditor, HeroContentEditor, EntitySearchSelect, Tooltip, SiteHeaderEditor | No overlay primitive; click-outside/Esc re-derived per component | Extract `ModalShell`/`Overlay` wrapper, migrate incrementally | medium |
| U3 | Empty-state fragmented (5+ variants) | `.empty-state`, `.preview-empty-message`, bespoke `__empty` in 5 files | Same concept, several drifting styles | Consolidate to one `.empty-state` (+ `--compact`) | medium |
| U4 | Missing `:focus-visible` on custom controls | `.table-link`, `.modal-close`, toggle buttons; `global.scss` suppresses non-visible outlines | Keyboard focus invisible on button-based controls | Shared `:focus-visible` ring on `.btn`/`.table-link`/`.modal-close`/toggles | medium |
| U5 | Inline block editors in the controller | `BlockEditController.tsx:21-80` (Hero/Reference/Spacer) | Inconsistent with `types/*Block.tsx` placement; controller mixes router + leaf | Move to `types/*` | low |
| U6 | `btn--small` / `btn--sm` byte-identical | `_buttons-badges.scss:102-110` | Two names invite drift | Alias `--small` to `--sm` | low |

## 3. Styling & design system

| ID | Title | Location | Problem | Fix | Risk |
|----|-------|----------|---------|-----|------|
| S1 | Hardcoded grays in SCSS (CLAUDE.md forbids) | `_pagination` 23/29, `_inline-editors` 378, `_block-editor` 545, `_mailing-lists` 136/161/164/186, `SocialEmbed.scss` 105-106 | Literal grays bypass tokens | `#333→$text-color`, `#f5f5f5/#fafafa→$background-dark`, `#eee/#ddd→$border-color`, `#999→$text-light` | low |
| S2 | Badge/alert status colors hardcoded | `_buttons-badges.scss:152-196` | Bootstrap-era hex, not themeable | Add `$success-bg/-fg` … pairs to `variables.scss` | low |
| S3 | Inline raw hex in `.tsx` | DatabaseSection 205/218/229, MessageView 71-101, FormSubmissions 116/128-140, Settings 379 | `#6b7280`=`$text-light`; bypass theming | Use `var(--admin-text-muted)` / `$background-dark` | low |
| S4 | Repeated inline label style (MessageView) | `MessageView.tsx:71-101` | Same style object ×5 | `.message-field__label` class | medium |
| S5 | Repeated stat-tile inline block | `FormSubmissions.tsx:128-141` | Identical tile style ×4 | `.stat-tile` + `__label` | medium |
| S6 | `ConfirmModal.scss` duplicates `shared/_modals.scss` | `ConfirmModal.scss` (self-flagged Phase C) | Two sources for same selectors | Drop the import + file | medium |
| S7 | Z-index scale defined but unused | `variables.scss:80-87` vs raw `9999/10000/2000/999` scattered | Modals (2000) below overlays (9999) — layering bugs | Route overlays through `$z-index-*` | high |
| S8 | No shared flex utility | ~13 inline `display:flex` objects with drifting gaps | Same flex row re-inlined | `.u-flex-row/.u-flex-col` utilities (token gaps) | high |

## 4. Architecture & code quality

### Frontend
| ID | Title | Location | Fix | Risk |
|----|-------|----------|-----|------|
| F1 | `generateBlockId` duplicated ×3, PostEditor divergent (non-UUID → `startsWith('block-')` hack) — **BUG** | BlockEditor:46, PageEditor:35, PostEditor:28 | `utils/blockId.ts`; all use crypto.randomUUID; drop hack | low |
| F2 | `<FlyoutPanel>+<BlockEditController>` triplicated | BlockEditor:651/758/785 | Local `renderEditPanel()`; fixes float-branch prop gap | medium |
| F3 | Block-type title-case built inline ×3 (+ partial) | BlockEditor:654/761/788, BlockPreview:70 | Use/extend `getBlockLabel` in `config/blockTypes.ts` | low |
| F4 | Flex-align keyword→CSS map duplicated ×6 | HeroCarousel:27-43, BlockRenderer:788, Footer:157, SiteFooterEditor:823/827, ContentBlock:265 | `utils/cssAlign.ts` `toFlexAlign()` + `TEXT_ALIGN` | low |
| F5 | Group container style computed twice (admin vs public) | ContentBlock:265, BlockRenderer:795 | Shared `groupContainerStyle(data)` util | low-med |
| F6 | `createResource(getAppearance)` boilerplate ×7 | PageEditor:111, PostEditor:48, +5 | `hooks/useAppearance.ts` | low |
| F7 | Post converter diverges; **drops `styleRef` on save (BUG)** | PostEditor:154/197/519 | `postBlock` converters via `blockStyleRef` kernel; `resolveDraftStyle` in preview | medium |
| F8 | Delete/Restore modal + try/catch/toast duplicated | PageEditor:498-539, PostEditor:449-492 | `useSoftDelete`/`DeleteRestoreModals` | medium |
| F9 | PageEditor/PostEditor share a large editor shell (SRP) | whole files (~580/571 lines) | `useEntityEditor` hook + `<EntityEditorShell>` | med-high |
| F10 | Deep `../../../../` imports from `blocks/types/*` | 6 files | vite/tsconfig path alias `@/…` | medium |
| F13 | `getErrorMessage`/`showError`/inline overlap | `hooks/useEditorState.ts` + call sites | one `toErrorMessage(err, fallback)` | low |

### Backend
| ID | Title | Location | Fix | Risk |
|----|-------|----------|-----|------|
| B1 | Manual pagination re-implements `paginatedQuery` | posts:267, messages:19, users:69/190, campaigns:201 | Route through `base.repo.paginatedQuery` | low |
| B2 | `buildSortClause` dup ×2 + hand-rolled ×3 | campaigns:32, shopProducts:55, posts:236, pages:70, media:213 | Hoist one `buildSortClause(sortBy,order,allowed)` to base/utils | low |
| B3 | `buildWhereClause` dead helper | `utils/mapRow.ts:77-120` (0 callers) | Adopt in repos or delete | low |
| B4 | Auth-cookie options duplicated ×4 | `routes/auth.ts` (128/171/234/314) | `setAuthCookies(res, tokens)` helper | low |
| B5 | Audit logging missing on media/fonts | `services/media.ts`, `services/fonts.ts` | Add `logAudit` to mutations | low |
| B6 | `services/payments.ts` SRP (791 lines) | webhook switch 576-789 | Extract `services/payment/webhook.ts` | medium |
| B7 | `services/settings.ts` SRP (625 lines) | feature cascade 293-437 | Extract `services/features/cascade.ts` | medium |
| B8 | Social providers switch-chain (OCP) | `services/social.ts:260/422` | `PROVIDERS` registry (mirror mail factory) | medium |
| B9 | ILIKE search block copy-pasted | messages:29, posts:231, users, forms | `ilikeSearch(cols, term, params)` helper | low-med |
| B10 | Bespoke 409 in settings route defeats error middleware | `routes/settings.ts:74-86` | Map `FeatureCascadeError`→409 in `middleware/error.ts`; drop `raw` | medium |
| B11 | No cache-invalidation contract | `cache.ts` vs raw `del`/`delPattern` in socialFeed/blockStyles | Centralize keys+invalidators in `cache.ts` | high |
| B12 | Block-type handling: per-consumer switch | `ssr/bodyBuilder.ts:155`, mail blocks, ssr routes | Converge on one block-type registry | high |

## 5. Recommended execution plan
- **Phase A (low risk, auto):** U1, U6, S1, S2, S3, F1, F3, F4, F6, F13, B1, B2, B4, B5, B9.
- **Phase B (medium):** U4, U5, S4, S5, S6, F2, F5, F7, F8, B8, B10.
- **Phase C (high / large — plan separately):** U2, U3, S7, S8, F9, F10, B3(dead-code), B6, B7, B11, B12.

## 6. Applied in this pass (verified — admin + server builds pass)

**Frontend (packages/cms):**
- **F1** — `utils/blockId.ts`; PageEditor/PostEditor/BlockEditor use it. PostEditor's divergent `block-<n>` generator + the `startsWith('block-')` save hack removed (posts now get real UUIDs like pages).
- **F7 (bug)** — PostEditor save now embeds the resolved `__styleRef` (via the `blockStyleRef` kernel); block styles set in the post editor persist instead of being silently dropped/wiped on save.
- **F2** — the 3× `FlyoutPanel`+`BlockEditController` in BlockEditor collapsed to one `renderEditPanel()` (also fixes the float branch's missing `isDirty`/`onRevert`).
- **F3** — `titleizeBlockType()` in `config/blockTypes.ts` replaces the inline title-case ×3.
- **F4** — `utils/cssAlign.ts` (`toFlexAlign` + `TEXT_ALIGN`); HeroCarousel + group renderers use it.
- **F5** — `utils/groupStyle.ts` (`groupContainerStyle`) shared by the public GroupBlock and the admin GroupBlockPreview (also unifies the previously-divergent align mapping).
- **F6** — `hooks/useAppearance.ts` replaces the `createResource(getAppearance)` boilerplate in Page/Post editors.
- **F13** — `toErrorMessage(err, fallback)` in `useEditorState`; `showError`/`getErrorMessage` delegate to it.
- **S1** — grays → tokens in `_pagination`, `_inline-editors`, `_block-editor`, `_mailing-lists`, `SocialEmbed.scss`.
- **S2** — soft status bg/fg tokens added to `variables.scss`; badge/alert selectors reference them.
- **S3/S4/S5** — inline hex → `var(--admin-*)`; MessageView field-label style + FormSubmissions stat tiles deduped to shared constants / a `<For>`.
- **U4** — `:focus-visible` rings on `.btn`, `.table-link`, `.modal-close`.
- **U6** — `.btn--small` aliased to `.btn--sm`.

**Backend (packages/api) — build + 108 tests pass, no external contract changes:**
- **B4** — `setAuthCookies(res, tokens, opts?)` in `routes/auth.ts`; 4 duplicated cookie blocks collapsed (byte-identical attributes; `opts.secure`/`opts.refreshMaxAge` cover dev-autologin + remember-me).
- **B5** — `logAudit` threaded through `services/media.ts` (upload/blockUpload/bulkUpload/updateMeta/remove) and `services/fonts.ts` (create/remove); routes pass `audit()`. Closes the media/font audit-trail gap.
- **B2 (partial)** — `buildSortClause(sortBy, sortOrder, allowed, default?)` hoisted+exported from `base.repo.ts`; the two byte-identical copies (`campaigns`, `shopProducts`) converted. **Skipped** the 3 hand-rolled switches (`posts`/`pages`/`media`) — they parse a single `title_asc`-style token with compound tie-breakers that `(col, dir)` can't express without changing ORDER BY.
- **B9** — `utils/queryBuilders.ts` `ilikeSearch(cols, term, params)`; adopted in `messages`/`posts`/`users`/`pages` repos. (`forms.repo` has no ILIKE search — the finding's example was off; `pages` had the identical pattern and was used instead.)
- **B1 (partial)** — `posts.findAllPosts`, `messages.findMessages`, `campaigns.findAllDonations` routed through `paginatedQuery`. **Skipped** `users.findUsers`/`findBans` — they assemble nested/projected rows `paginatedQuery`'s `mapRows` would reshape.
- **B8** — `services/social.ts` two `switch(platform)` blocks → a `PROVIDERS` registry lookup.
- **B10** — `middleware/error.ts` maps `FeatureCascadeError` → 409 (identical body); settings `PUT /` dropped its `raw`+try/catch and is a thin handler again.

## 7. Deferred (documented for a dedicated pass — too broad/risky to land safely without tests)
- **F8** — delete/restore modal + try/catch/toast dedup (`useSoftDelete`). Pure dedup, no bug; skipped to avoid re-touching both editors in this pass.
- **F9** — `useEntityEditor` + `<EntityEditorShell>` extraction (largest LOC dup; end-to-end on both editors).
- **F10** — `@/…` path aliases (vite/tsconfig change, broad mechanical churn).
- **U1 / S6 / B3** — deletions (dead `ui/Toggle`, duplicate `ConfirmModal.scss`, dead `buildWhereClause`) → defer to `/dead-code` per the "never delete" rule.
- **U2 / U3 / S7 / S8** — `ModalShell`/overlay primitive, empty-state consolidation, z-index scale adoption, flex utilities — broad cross-cutting UI/token work.
- **B6 / B7** — `services/payments.ts` + `services/settings.ts` SRP splits (large moves).
- **B11 / B12** — cache-invalidation contract + block-type registry (cross-cutting; own pass).

Recommend `/implement` or `superpowers:writing-plans` for F9, B6/B7, and B11/B12.
