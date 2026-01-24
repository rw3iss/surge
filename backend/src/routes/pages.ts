import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { cache } from '../services/cache';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../middleware/error';
import { logger } from '../utils/logger';
import type { Page, Block, PageStatus, BlockType } from '@surge/shared';

const router = Router();

const pageSchema = z.object({
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  metaTitle: z.string().max(255).optional(),
  metaDescription: z.string().optional(),
  metaKeywords: z.array(z.string()).optional(),
  ogImage: z.string().url().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  isHomepage: z.boolean().optional(),
  showInNav: z.boolean().optional(),
  navOrder: z.number().int().optional(),
  isPrivate: z.boolean().optional(),
});

const blockSchema = z.object({
  type: z.enum(['rich_text', 'post', 'form', 'image', 'video', 'gallery', 'social_feed', 'campaign', 'hero', 'html']),
  title: z.string().max(255).optional(),
  content: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
  order: z.number().int().optional(),
  isVisible: z.boolean().optional(),
});

function toPage(row: Record<string, unknown>): Page {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    description: row.description as string | undefined,
    metaTitle: row.meta_title as string | undefined,
    metaDescription: row.meta_description as string | undefined,
    metaKeywords: row.meta_keywords as string[] | undefined,
    ogImage: row.og_image as string | undefined,
    status: row.status as PageStatus,
    isHomepage: row.is_homepage as boolean,
    showInNav: row.show_in_nav as boolean,
    navOrder: row.nav_order as number,
    isPrivate: row.is_private as boolean,
    blocks: [],
    createdBy: row.created_by as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function toBlock(row: Record<string, unknown>): Block {
  return {
    id: row.id as string,
    pageId: row.page_id as string,
    type: row.type as BlockType,
    title: row.title as string | undefined,
    content: row.content as string | undefined,
    settings: row.settings as Record<string, unknown>,
    order: row.order as number,
    isVisible: row.is_visible as boolean,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// Get navigation items (public)
router.get('/navigation', async (req, res) => {
  try {
    const cacheKey = 'navigation:main';
    const cached = await cache.get(cacheKey);

    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const result = await query(
      `SELECT id, slug, title, show_in_nav, nav_order, is_private
       FROM pages
       WHERE show_in_nav = true AND status = 'published'
       ORDER BY nav_order ASC`
    );

    const navigation = result.rows.map((row) => ({
      id: row.id,
      label: row.title,
      slug: row.slug,
      isExternal: false,
      order: row.nav_order,
      isVisible: row.show_in_nav,
      requiresAuth: row.is_private,
    }));

    await cache.set(cacheKey, navigation, 600);

    res.json({ success: true, data: navigation });
  } catch (error) {
    logger.error('Error fetching navigation', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch navigation' },
    });
  }
});

// Get all pages (admin)
router.get('/', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (title ILIKE $${params.length} OR slug ILIKE $${params.length})`;
    }

    const countResult = await query(`SELECT COUNT(*) FROM pages ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(Number(limit), offset);
    const result = await query(
      `SELECT * FROM pages ${whereClause}
       ORDER BY nav_order ASC, created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const pages = result.rows.map(toPage);

    res.json({
      success: true,
      data: pages,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error fetching pages', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch pages' },
    });
  }
});

// Get page by slug (public, with auth check for private pages)
router.get('/slug/:slug', authenticate(false), async (req: AuthenticatedRequest, res) => {
  try {
    const { slug } = req.params;
    const cacheKey = `page:slug:${slug}`;

    // Check cache for public pages
    if (!req.user) {
      const cached = await cache.get<Page>(cacheKey);
      if (cached && !cached.isPrivate) {
        return res.json({ success: true, data: cached });
      }
    }

    const pageResult = await query(
      `SELECT * FROM pages WHERE slug = $1 AND status = 'published'`,
      [slug]
    );

    if (pageResult.rows.length === 0) {
      throw new NotFoundError('Page');
    }

    const pageRow = pageResult.rows[0];

    // Check if page is private
    if (pageRow.is_private && !req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const page = toPage(pageRow);

    // Fetch blocks
    const blocksResult = await query(
      `SELECT * FROM blocks WHERE page_id = $1 AND is_visible = true ORDER BY "order" ASC`,
      [page.id]
    );

    page.blocks = blocksResult.rows.map(toBlock);

    // Cache public pages
    if (!page.isPrivate) {
      await cache.set(cacheKey, page, 300);
    }

    res.json({ success: true, data: page });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error fetching page', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch page' },
    });
  }
});

// Get page by ID (admin)
router.get('/:id', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const pageResult = await query('SELECT * FROM pages WHERE id = $1', [id]);

    if (pageResult.rows.length === 0) {
      throw new NotFoundError('Page');
    }

    const page = toPage(pageResult.rows[0]);

    const blocksResult = await query(
      `SELECT * FROM blocks WHERE page_id = $1 ORDER BY "order" ASC`,
      [page.id]
    );

    page.blocks = blocksResult.rows.map(toBlock);

    res.json({ success: true, data: page });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error fetching page', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch page' },
    });
  }
});

// Create page (admin)
router.post('/', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const data = pageSchema.parse(req.body);

    // If setting as homepage, unset other homepage
    if (data.isHomepage) {
      await query(`UPDATE pages SET is_homepage = false WHERE is_homepage = true`);
    }

    const result = await query(
      `INSERT INTO pages (slug, title, description, meta_title, meta_description,
                          meta_keywords, og_image, status, is_homepage, show_in_nav,
                          nav_order, is_private, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        data.slug,
        data.title,
        data.description,
        data.metaTitle,
        data.metaDescription,
        data.metaKeywords || [],
        data.ogImage,
        data.status || 'draft',
        data.isHomepage || false,
        data.showInNav || false,
        data.navOrder || 0,
        data.isPrivate || false,
        req.userId,
      ]
    );

    await cache.invalidatePageCache();

    const page = toPage(result.rows[0]);
    page.blocks = [];

    res.status(201).json({ success: true, data: page });
  } catch (error) {
    logger.error('Error creating page', { error });
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid data', details: error.errors },
      });
    }
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create page' },
    });
  }
});

// Update page (admin)
router.put('/:id', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const data = pageSchema.partial().parse(req.body);

    // Check if page exists
    const existing = await query('SELECT id FROM pages WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new NotFoundError('Page');
    }

    // If setting as homepage, unset other homepage
    if (data.isHomepage) {
      await query(`UPDATE pages SET is_homepage = false WHERE is_homepage = true AND id != $1`, [id]);
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        values.push(value);
        updates.push(`${dbKey} = $${values.length}`);
      }
    });

    if (updates.length === 0) {
      throw new ValidationError('No fields to update');
    }

    values.push(id);
    const result = await query(
      `UPDATE pages SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    await cache.invalidatePageCache(id);

    const page = toPage(result.rows[0]);

    res.json({ success: true, data: page });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error updating page', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update page' },
    });
  }
});

// Delete page (admin)
router.delete('/:id', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM pages WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Page');
    }

    await cache.invalidatePageCache(id);

    res.json({ success: true, data: { message: 'Page deleted' } });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error deleting page', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete page' },
    });
  }
});

// Block routes

// Add block to page (admin)
router.post('/:pageId/blocks', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { pageId } = req.params;
    const data = blockSchema.parse(req.body);

    // Verify page exists
    const pageExists = await query('SELECT id FROM pages WHERE id = $1', [pageId]);
    if (pageExists.rows.length === 0) {
      throw new NotFoundError('Page');
    }

    // Get max order
    const maxOrder = await query(
      'SELECT COALESCE(MAX("order"), -1) + 1 as next_order FROM blocks WHERE page_id = $1',
      [pageId]
    );

    const result = await query(
      `INSERT INTO blocks (page_id, type, title, content, settings, "order", is_visible)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        pageId,
        data.type,
        data.title,
        data.content,
        JSON.stringify(data.settings || {}),
        data.order ?? maxOrder.rows[0].next_order,
        data.isVisible ?? true,
      ]
    );

    await cache.invalidatePageCache(pageId);

    const block = toBlock(result.rows[0]);

    res.status(201).json({ success: true, data: block });
  } catch (error) {
    logger.error('Error creating block', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create block' },
    });
  }
});

// Update block (admin)
router.put('/:pageId/blocks/:blockId', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { pageId, blockId } = req.params;
    const data = blockSchema.partial().parse(req.body);

    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.type !== undefined) {
      values.push(data.type);
      updates.push(`type = $${values.length}`);
    }
    if (data.title !== undefined) {
      values.push(data.title);
      updates.push(`title = $${values.length}`);
    }
    if (data.content !== undefined) {
      values.push(data.content);
      updates.push(`content = $${values.length}`);
    }
    if (data.settings !== undefined) {
      values.push(JSON.stringify(data.settings));
      updates.push(`settings = $${values.length}`);
    }
    if (data.order !== undefined) {
      values.push(data.order);
      updates.push(`"order" = $${values.length}`);
    }
    if (data.isVisible !== undefined) {
      values.push(data.isVisible);
      updates.push(`is_visible = $${values.length}`);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update');
    }

    values.push(blockId, pageId);
    const result = await query(
      `UPDATE blocks SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length - 1} AND page_id = $${values.length}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Block');
    }

    await cache.invalidatePageCache(pageId);

    const block = toBlock(result.rows[0]);

    res.json({ success: true, data: block });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error updating block', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update block' },
    });
  }
});

// Delete block (admin)
router.delete('/:pageId/blocks/:blockId', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { pageId, blockId } = req.params;

    const result = await query(
      'DELETE FROM blocks WHERE id = $1 AND page_id = $2 RETURNING id',
      [blockId, pageId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Block');
    }

    await cache.invalidatePageCache(pageId);

    res.json({ success: true, data: { message: 'Block deleted' } });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error deleting block', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete block' },
    });
  }
});

// Reorder blocks (admin)
router.put('/:pageId/blocks/reorder', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { pageId } = req.params;
    const { blockIds } = req.body;

    if (!Array.isArray(blockIds)) {
      throw new ValidationError('blockIds must be an array');
    }

    for (let i = 0; i < blockIds.length; i++) {
      await query(
        `UPDATE blocks SET "order" = $1, updated_at = NOW() WHERE id = $2 AND page_id = $3`,
        [i, blockIds[i], pageId]
      );
    }

    await cache.invalidatePageCache(pageId);

    res.json({ success: true, data: { message: 'Blocks reordered' } });
  } catch (error) {
    logger.error('Error reordering blocks', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to reorder blocks' },
    });
  }
});

export default router;
