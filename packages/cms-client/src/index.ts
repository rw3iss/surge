/**
 * @rw/cms-client — headless TypeScript client for any hosted CMS backend.
 *
 * Goal: mirror the in-process `cms.*` service aggregate over HTTP so that
 * any consumer (our own @rw/cms-web SPA, external apps, Node scripts) routes
 * ALL client-side API calls through this package once it is built. Zero
 * runtime dependencies; fetch-based; works in Node ≥ 18 and modern browsers.
 *
 * Status: NOT IMPLEMENTED — structure scaffold only.
 * See: docs/client-sdk-plan.md for the full charter, auth strategy, error
 *      mapping, pagination conventions, and suggested package layout.
 *      docs/API.md and docs/api-manifest.json for the 28-module / 196-route
 *      surface this client will cover.
 */

export {};
