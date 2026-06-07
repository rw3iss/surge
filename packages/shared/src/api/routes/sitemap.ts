/**
 * Wire DTOs for the /sitemap module.
 *
 * GET /sitemap.xml is a RAW route — mounted at the site root (so crawlers
 * find it), OUTSIDE the standard JSON surface. The response is an XML
 * STRING served with `Content-Type: application/xml`, not the
 * `ApiResponse<T>` envelope; a transient error yields an empty-but-valid
 * sitemap with the same content-type. `SitemapXmlResponse` is a marker
 * for that body.
 *
 * POST /admin/sitemap/regenerate IS a normal admin JSON route — its
 * `data` payload (`SitemapRegenerateResponse`) rides the standard
 * envelope.
 */

/** GET /sitemap.xml — the raw sitemap document, as an XML string. */
export type SitemapXmlResponse = string;

/** POST /admin/sitemap/regenerate — rebuild stats (standard envelope). */
export interface SitemapRegenerateResponse {
    urlCount: number;
    bytes: number;
    /** ISO date-time the cache was rebuilt. */
    regeneratedAt: string;
}
