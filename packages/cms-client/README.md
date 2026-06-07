# @rw/cms-client

> **NOT IMPLEMENTED** — structure scaffold only. See [docs/client-sdk-plan.md](../../docs/client-sdk-plan.md) for the full charter.

Typed TypeScript HTTP client for the SiteSurge CMS backend. Once built, ALL
client-side API requests from `@rw/cms-web` and any external consumer will flow
through this package.

## Goal

```ts
const cms = createClient({ baseUrl, auth: { apiKey: 'ssk_…' } });
const posts = await cms.posts.list({ status: 'all' });   // typed, paginated
const post  = await cms.posts.getBySlug('hello-world');  // throws ContentLockedError
```

Works in Node ≥ 18 and modern browsers. Zero runtime dependencies (fetch-based).

## References

- **Charter & design decisions:** [docs/client-sdk-plan.md](../../docs/client-sdk-plan.md)
- **API surface (28 modules / 196 routes):** [docs/API.md](../../docs/API.md)
- **Machine-readable manifest:** [docs/api-manifest.json](../../docs/api-manifest.json)
- **Shared types & DTOs:** `@rw/cms-shared` ([packages/shared](../shared))

## Planned layout

```
packages/cms-client/
├── src/
│   ├── core/           # fetch wrapper, auth, token refresh, typed errors
│   ├── modules/        # one namespace per manifest module
│   └── index.ts        # createClient() factory
├── config/cms-client/
│   └── tsconfig.json   # build config (rooted here, extended by tsconfig stub)
├── package.json
└── README.md           # this file
```
