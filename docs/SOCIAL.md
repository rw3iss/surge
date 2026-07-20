# Social feed & publishing

SiteSurge displays your social posts with a **capture-first, render-locally**
model: post ids enter the local `social_posts` cache, and each post is rendered
server-side into a native card (no third-party scripts). This avoids scraping
and the paywalled read-timeline APIs for the default path.

Everything lives under the admin **Social** section (`/admin/social`), gated by
the `social` feature (enabled by default; toggle in Settings → Features). The
hub has three tabs:

- **Posts** — the local cache. Add posts by URL, hide/show, reorder, delete.
- **Compose** — write once and cross-post to connected providers.
- **Configuration** — provider connections + per-provider utilities (relocated
  from the old Settings → Connections).

## The three ways a post enters the feed

| Source | How | Cost | Providers |
|--------|-----|------|-----------|
| `posse` | Compose in the CMS → published via the provider's write API → the created post is captured back | Free | X (today) |
| `manual` | Paste a post's permalink on the Posts tab | Free | X (today) |
| `sync` | Pulled from a provider read API on a schedule / manual "Sync now" | Free for IG/FB/YT; **paid** for X | IG, FB, YT, (X in API mode) |

Manual + POSSE cover the free X feed with no read-API access at all.

## X / Twitter — the free path (default)

X monetized *reading* timelines (Basic tier ≈ $100/mo) but **writing is still
free**. So SiteSurge defaults X to **free mode**:

- **Compose** posts in the CMS → published via `POST /2/tweets` (free write tier,
  user-context OAuth 1.0a) → the new tweet is captured as a `posse` post.
- **Paste** any tweet URL on the Posts tab to add an existing tweet.

Both are rendered by hydrating the tweet server-side via
`cdn.syndication.twimg.com/tweet-result` (the same public endpoint `react-tweet`
uses) into a native `SocialEmbed` card — cached in Redis, no X JavaScript. If a
tweet can't be hydrated, we fall back to X's official **oEmbed** HTML
(sanitized).

> **Reliability caveat:** the `tweet-result` endpoint is public but undocumented;
> X can change it. The oEmbed fallback and the stored text/permalink mean a post
> never disappears — worst case it renders as a minimal card / link.

### Free-mode credentials (compose)

To compose to X you need a free X developer app with **user-context** OAuth 1.0a
credentials. In Configuration → Twitter/X, save (in the credentials blob):

- `apiKey` / `apiSecret` — the app's consumer key/secret
- `accessToken` / `accessSecret` — your user access token/secret (with
  `tweet.write`)

Reading (auto-sync) is **not** required for the free feed.

## X / Twitter — the paid API path (opt-in)

If you want fully-automatic discovery of *all* your posts (including ones tapped
out in the X app), switch Configuration → Twitter/X → **Feed mode** to **API**
and provide a **Basic-tier bearer token**. Then:

- The read-sync (`fetchTwitterPosts`) is enabled — in **free mode it is skipped**
  entirely.
- Syncs use `since_id` (watermarked in the connection `settings.lastTweetId`) and
  pull ≤10 per run, keeping usage under the Basic-tier ~10k posts/month cap.
- Sync hourly rather than aggressively.

### Media (photos + video)

The Compose tab can attach media from the media library. On publish, the server
fetches each asset's bytes and uploads them to X (user-context OAuth 1.0a, same
credentials as text posting), then attaches the returned `media_id`s to the
tweet:

- **Photos** (≤5 MB, non-GIF) — one-shot upload.
- **Video / GIF / large images** — chunked `INIT`/`APPEND`/`FINALIZE`, then the
  server polls `STATUS` until processing completes (videos are async).

X's per-post rules are enforced: **up to 4 photos, OR exactly one video/GIF**.
Media upload targets the v1.1 `upload.twitter.com` host (the canonical
OAuth-1.0a media flow); if X retires it, switch `UPLOAD_URL` in
`services/social/twitterMedia.ts` to `/2/media/upload`. Media upload is part of
the write surface and generally works on the free tier — confirm with a live
test post, since X's access gates shift.

## Other providers

Instagram / Facebook / YouTube use their existing OAuth/API connections and the
read-sync path (with media mirrored into local storage for IG/FB, whose CDN URLs
expire). Compose/cross-post to these is not implemented yet — the Compose tab
greys them out with a reason.

## Rendering

The public Social block renders stored posts as `SocialEmbed` cards. Manual and
POSSE posts have the same shape as synced ones, so they render identically.
Hidden posts (`is_hidden`) are excluded from public feeds but visible to admins
on the Posts tab for curation.

## API surface

- `POST /social/publish` — compose & cross-post `{ providers, text }`.
- `POST /social/posts/manual` — add by URL `{ url }`.
- `PATCH /social/posts/:id` — `{ isHidden?, sortOrder? }`.
- `GET /social/posts/:id/embed` — resolve to `{ mode: 'card'|'oembed', card?, html? }`.
- `GET /social/posts/:platform?includeHidden=true` — admin listing (hidden gated
  on an authenticated admin).

All exposed on the SDK as `cms.social.*`.
