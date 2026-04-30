/**
 * Public sitemap.xml route — cached for 1 hour and busted on content
 * changes via the invalidators in services/cache.ts. Mounted at the
 * site root so crawlers find it at the canonical `/sitemap.xml` URL.
 *
 * Also exposes an admin POST that drops the cache and returns the
 * fresh URL count, for the "Regenerate sitemap" button in the admin.
 */
import { Request, Response, Router, } from 'express';
import { authenticate, requireAdmin, type AuthenticatedRequest, } from '../middleware/auth';
import { cache, } from '../services/cache';
import { buildSitemap, countSitemapUrls, } from '../services/sitemap';
import { sendSuccess, } from '../utils/response';
import { logger, } from '../utils/logger';

const router = Router();
const CACHE_KEY = 'sitemap:xml';
const CACHE_TTL = 3600; // 1 hour

router.get('/sitemap.xml', async (_req: Request, res: Response,) => {
    try {
        const cached = await cache.get<string>(CACHE_KEY,);
        if (cached) {
            res.set('Content-Type', 'application/xml',);
            res.send(cached,);
            return;
        }

        const xml = await buildSitemap();
        await cache.set(CACHE_KEY, xml, CACHE_TTL,);

        res.set('Content-Type', 'application/xml',);
        res.send(xml,);
    } catch (error) {
        logger.error('Error generating sitemap', { error, },);
        res.status(500,).set('Content-Type', 'application/xml',).send(
            '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
        );
    }
},);

/** Admin: drop the cached sitemap + rebuild now. Returns the URL count
 *  so the operator gets a quick confirmation. Also useful from cron /
 *  CI via a session-cookie or token-based admin call. */
router.post(
    '/admin/sitemap/regenerate',
    authenticate(),
    requireAdmin,
    async (_req: AuthenticatedRequest, res: Response,) => {
        try {
            await cache.invalidateSitemapCache();
            const xml = await buildSitemap();
            await cache.set(CACHE_KEY, xml, CACHE_TTL,);
            sendSuccess(res, {
                urlCount: countSitemapUrls(xml,),
                bytes: xml.length,
                regeneratedAt: new Date().toISOString(),
            },);
        } catch (error) {
            logger.error('Admin sitemap regenerate failed', { error, },);
            res.status(500,).json({ success: false, error: 'Regenerate failed', },);
        }
    },
);

export default router;
