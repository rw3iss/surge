/**
 * Wire DTOs for the /unsubscribe module (mailing-list opt-out + opt-in).
 *
 * ALL RAW routes — mounted at the public root (NOT under `/api/v1`) so
 * the URLs stay short and work as `List-Unsubscribe` header targets:
 *
 *   GET /u/:token                   — unsubscribe
 *   GET /u/:token/resubscribe       — resubscribe
 *   GET /lists/:slug/confirm/:token — double-opt-in confirmation
 *
 * Each responds with a full HTML PAGE (`Content-Type: text/html`) and a
 * route-chosen status (200 on success, 400 on a bad/expired link, 404
 * when the subscriber/list is missing), NOT the `ApiResponse<T>`
 * envelope. The types below are markers for the body + the route params;
 * there is no JSON DTO. (Precedent: the feed/sitemap raw-route notes.)
 */

/** GET /u/:token (and the resubscribe variant) — path token. */
export interface UnsubscribeTokenParams {
    token: string;
}

/** GET /lists/:slug/confirm/:token — list slug + confirmation token. */
export interface UnsubscribeConfirmParams {
    slug: string;
    token: string;
}

/** The raw HTML page body returned by every route in this module. */
export type UnsubscribeHtmlResponse = string;
