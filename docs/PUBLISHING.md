# Publishing SiteSurge packages

The monorepo publishes three public libraries to npm under the **`@sitesurge`**
scope, using [Changesets](https://github.com/changesets/changesets):

| Package | Published | Notes |
|---|---|---|
| `@sitesurge/types` | ✅ npm | types + API DTOs + utils (`packages/shared`) |
| `@sitesurge/client` | ✅ npm | headless HTTP SDK (`packages/cms-client`) |
| `@sitesurge/mcp` | ✅ npm | MCP server, bin `sitesurge-mcp` (`packages/cms-mcp`) |
| `@sitesurge/server` | ❌ private (Phase 4) | ships as a Docker image; npm later |
| `@sitesurge/admin` | ❌ private | app, bundled into the server |

Server/admin are marked `private: true` and are in the Changesets `ignore` list,
so they're never pushed to npm.

## Day-to-day: adding a change

When you change a published package, add a changeset in the same PR:

```bash
pnpm changeset          # pick packages + bump type (patch/minor/major), write a summary
git add .changeset && git commit
```

Internal `workspace:*` deps are rewritten to the published version range at
publish time — you don't hand-edit versions.

## Releasing

Automated (recommended): the **Release** GitHub Action (`.github/workflows/release.yml`)
watches `main`.
1. Merging PRs that contain changesets makes the action open/refresh a
   **"Version Packages"** PR (bumps versions + writes changelogs).
2. Merging that PR triggers the action to **build + publish** to npm.

**One-time setup:** add a repo secret **`NPM_TOKEN`** — an npm *automation* token
with publish rights to the `@sitesurge` scope (create the org/scope on npm first).

Manual (local) equivalent:

```bash
pnpm changeset          # (once, if not already added)
pnpm version-packages   # applies versions + changelogs
pnpm release            # builds, then `changeset publish` → npm
```

`pnpm release` = `pnpm run build && changeset publish`; publish respects
`private` + the `ignore` list, so only the three libraries go out.

## Pre-publish checklist

- [ ] **Confirm the license.** The libraries declare `MIT` — change it (and add
      `LICENSE` files) before the first publish if that's not what you want.
- [ ] **Node-resolvable `@sitesurge/types` build** (packaging spec Phase 3): today
      the types build uses bundler-style directory imports, so the packages work
      for **bundler-based** consumers (Vite/webpack/tsup/Next) but not raw `node`.
      Do the first publish only after Phase 3 if you need raw-Node support (the
      SDK's own consumers are almost always bundler-based, so a `0.x` preview is
      fine before then).
- [ ] `npm org` / scope `@sitesurge` created and `NPM_TOKEN` set.
- [ ] `pnpm build && pnpm test` green (CI enforces).

See the full plan: `docs/superpowers/specs/2026-07-11-packaging-and-init-design.md`.
