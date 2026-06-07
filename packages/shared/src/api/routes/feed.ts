/**
 * Wire DTOs for the /feed module (RSS 2.0).
 *
 * RAW route — mounted at `/feed.xml` (and `/api/v1/feed.xml`), OUTSIDE
 * the standard `/api/v1` JSON surface. The response is an XML STRING
 * served with `Content-Type: application/rss+xml; charset=utf-8`, not the
 * `ApiResponse<T>` envelope. On a transient build error it answers 500
 * with a valid-but-empty feed (same content-type) so aggregators don't
 * blacklist the URL. This marker type documents the body for consumers;
 * there is no JSON DTO. (Precedent: the health module's raw-route note.)
 */

/** GET /feed.xml — the raw RSS 2.0 document, as an XML string. */
export type FeedXmlResponse = string;
