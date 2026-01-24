import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { cache } from '../services/cache';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { NotFoundError } from '../middleware/error';
import { logger } from '../utils/logger';
import type { Post, PostStatus } from '@surge/shared';

const router = Router();

const contentBlockSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['text', 'social_media', 'image', 'video', 'document', 'url_link']),
  sort_order: z.number().int().min(0),
  data: z.record(z.unknown()).default({}),
});

const postSchema = z.object({
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(255),
  excerpt: z.string().optional(),
  content: z.string().optional().default(''),
  featuredImage: z.string().url().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  isPrivate: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  metaTitle: z.string().max(255).optional(),
  metaDescription: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  contentBlocks: z.array(contentBlockSchema).optional(),
});

interface ContentBlock {
  id: string;
  type: string;
  sortOrder: number;
  data: Record<string, unknown>;
}

function toContentBlock(row: Record<string, unknown>): ContentBlock {
  return {
    id: row.id as string,
    type: row.type as string,
    sortOrder: row.sort_order as number,
    data: (row.data as Record<string, unknown>) || {},
  };
}

async function fetchContentBlocks(postId: string): Promise<ContentBlock[]> {
  const result = await query(
    'SELECT * FROM post_content_blocks WHERE post_id = $1 ORDER BY sort_order ASC',
    [postId]
  );
  return result.rows.map(toContentBlock);
}

async function saveContentBlocks(postId: string, blocks: { type: string; sort_order: number; data: Record<string, unknown> }[]): Promise<void> {
  // Delete existing blocks and re-insert
  await query('DELETE FROM post_content_blocks WHERE post_id = $1', [postId]);

  for (const block of blocks) {
    const data = block.data as Record<string, any>;
    await query(
      `INSERT INTO post_content_blocks (post_id, type, sort_order, data, provider, media_url, file_name, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        postId,
        block.type,
        block.sort_order,
        data,
        data.provider || null,
        data.url || null,
        data.fileName || null,
        data.fileSize || null,
        data.mimeType || null,
      ]
    );
  }
}

function toPost(row: Record<string, unknown>): Post {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    excerpt: row.excerpt as string | undefined,
    content: row.content as string,
    featuredImage: row.featured_image as string | undefined,
    author: row.author as string,
    authorId: row.author_id as string,
    status: row.status as PostStatus,
    isPrivate: row.is_private as boolean,
    tags: row.tags as string[],
    categories: row.categories as string[],
    metaTitle: row.meta_title as string | undefined,
    metaDescription: row.meta_description as string | undefined,
    publishedAt: row.published_at ? new Date(row.published_at as string) : undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// Get published posts (public)
router.get('/public', authenticate(false), async (req: AuthenticatedRequest, res) => {
  try {
    const { page = 1, limit = 10, tag, category, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const cacheKey = `posts:public:${page}:${limit}:${tag || ''}:${category || ''}:${search || ''}`;

    if (!req.user) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({ success: true, ...cached });
      }
    }

    let whereClause = `WHERE status = 'published' AND is_private = false`;
    const params: unknown[] = [];

    if (tag) {
      params.push(tag);
      whereClause += ` AND $${params.length} = ANY(tags)`;
    }

    if (category) {
      params.push(category);
      whereClause += ` AND $${params.length} = ANY(categories)`;
    }

    if (search) {
      params.push(search);
      whereClause += ` AND search_vector @@ plainto_tsquery('english', $${params.length})`;
    }

    const countResult = await query(`SELECT COUNT(*) FROM posts ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(Number(limit), offset);
    const result = await query(
      `SELECT p.*, u.display_name as author
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       ${whereClause}
       ORDER BY published_at DESC NULLS LAST, created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const posts = result.rows.map(toPost);
    const response = {
      data: posts,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    };

    if (!req.user) {
      await cache.set(cacheKey, response, 300);
    }

    res.json({ success: true, ...response });
  } catch (error) {
    logger.error('Error fetching public posts', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch posts' },
    });
  }
});

// Get all posts (admin)
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
      params.push(search);
      whereClause += ` AND search_vector @@ plainto_tsquery('english', $${params.length})`;
    }

    const countResult = await query(`SELECT COUNT(*) FROM posts ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(Number(limit), offset);
    const result = await query(
      `SELECT p.*, u.display_name as author,
              (SELECT COUNT(*) FROM post_content_blocks pcb WHERE pcb.post_id = p.id)::int as block_count
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const posts = result.rows.map(row => ({
      ...toPost(row),
      blockCount: row.block_count as number,
    }));

    res.json({
      success: true,
      data: posts,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error fetching posts', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch posts' },
    });
  }
});

// Get post by slug (public)
router.get('/slug/:slug', authenticate(false), async (req: AuthenticatedRequest, res) => {
  try {
    const { slug } = req.params;
    const cacheKey = `post:slug:${slug}`;

    if (!req.user) {
      const cached = await cache.get<Post>(cacheKey);
      if (cached && !cached.isPrivate) {
        return res.json({ success: true, data: cached });
      }
    }

    const result = await query(
      `SELECT p.*, u.display_name as author
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       WHERE p.slug = $1 AND p.status = 'published'`,
      [slug]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Post');
    }

    const postRow = result.rows[0];

    if (postRow.is_private && !req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const post = toPost(postRow);
    const contentBlocks = await fetchContentBlocks(post.id);
    const postWithBlocks = { ...post, contentBlocks };

    if (!post.isPrivate) {
      await cache.set(cacheKey, postWithBlocks, 300);
    }

    res.json({ success: true, data: postWithBlocks });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error fetching post', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch post' },
    });
  }
});

// Get post by ID (admin)
router.get('/:id', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT p.*, u.display_name as author
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Post');
    }

    const post = toPost(result.rows[0]);
    const contentBlocks = await fetchContentBlocks(id);

    res.json({ success: true, data: { ...post, contentBlocks } });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error fetching post', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch post' },
    });
  }
});

// Create post (admin)
router.post('/', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const data = postSchema.parse(req.body);

    const publishedAt = data.status === 'published' ? (data.publishedAt || new Date().toISOString()) : null;

    const result = await query(
      `INSERT INTO posts (slug, title, excerpt, content, featured_image, author_id,
                          status, is_private, tags, categories, meta_title,
                          meta_description, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        data.slug,
        data.title,
        data.excerpt,
        data.content || '',
        data.featuredImage,
        req.userId,
        data.status || 'draft',
        data.isPrivate || false,
        data.tags || [],
        data.categories || [],
        data.metaTitle,
        data.metaDescription,
        publishedAt,
      ]
    );

    const post = toPost(result.rows[0]);

    // Save content blocks
    if (data.contentBlocks?.length) {
      await saveContentBlocks(post.id, data.contentBlocks);
    }

    await cache.invalidatePostCache();

    const contentBlocks = await fetchContentBlocks(post.id);
    res.status(201).json({ success: true, data: { ...post, contentBlocks } });
  } catch (error: any) {
    logger.error('Error creating post', { error });
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid data', details: error.errors },
      });
    }
    if (error?.code === '23505') {
      const detail = error.detail || '';
      const field = detail.includes('slug') ? 'slug' : 'field';
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE', message: `A post with this ${field} already exists` },
      });
    }
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error?.message || 'Failed to create post' },
    });
  }
});

// Update post (admin)
router.put('/:id', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const data = postSchema.partial().parse(req.body);

    const existing = await query('SELECT status FROM posts WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new NotFoundError('Post');
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.slug !== undefined) {
      values.push(data.slug);
      updates.push(`slug = $${values.length}`);
    }
    if (data.title !== undefined) {
      values.push(data.title);
      updates.push(`title = $${values.length}`);
    }
    if (data.excerpt !== undefined) {
      values.push(data.excerpt);
      updates.push(`excerpt = $${values.length}`);
    }
    if (data.content !== undefined) {
      values.push(data.content);
      updates.push(`content = $${values.length}`);
    }
    if (data.featuredImage !== undefined) {
      values.push(data.featuredImage);
      updates.push(`featured_image = $${values.length}`);
    }
    if (data.status !== undefined) {
      values.push(data.status);
      updates.push(`status = $${values.length}`);

      // Set published_at if publishing for first time
      if (data.status === 'published' && existing.rows[0].status !== 'published') {
        values.push(new Date().toISOString());
        updates.push(`published_at = COALESCE(published_at, $${values.length})`);
      }
    }
    if (data.isPrivate !== undefined) {
      values.push(data.isPrivate);
      updates.push(`is_private = $${values.length}`);
    }
    if (data.tags !== undefined) {
      values.push(data.tags);
      updates.push(`tags = $${values.length}`);
    }
    if (data.categories !== undefined) {
      values.push(data.categories);
      updates.push(`categories = $${values.length}`);
    }
    if (data.metaTitle !== undefined) {
      values.push(data.metaTitle);
      updates.push(`meta_title = $${values.length}`);
    }
    if (data.metaDescription !== undefined) {
      values.push(data.metaDescription);
      updates.push(`meta_description = $${values.length}`);
    }

    if (updates.length > 0) {
      values.push(id);
      await query(
        `UPDATE posts SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $${values.length}
         RETURNING *`,
        values
      );
    }

    // Save content blocks if provided
    if (data.contentBlocks !== undefined) {
      await saveContentBlocks(id, data.contentBlocks || []);
    }

    await cache.invalidatePostCache(id);

    // Fetch updated post with blocks
    const postResult = await query(
      `SELECT p.*, u.display_name as author
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       WHERE p.id = $1`,
      [id]
    );
    const post = toPost(postResult.rows[0]);
    const contentBlocks = await fetchContentBlocks(id);

    res.json({ success: true, data: { ...post, contentBlocks } });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    if (error?.code === '23505') {
      const detail = error.detail || '';
      const field = detail.includes('slug') ? 'slug' : 'field';
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE', message: `A post with this ${field} already exists` },
      });
    }
    logger.error('Error updating post', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error?.message || 'Failed to update post' },
    });
  }
});

// Delete post (admin)
router.delete('/:id', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM posts WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Post');
    }

    await cache.invalidatePostCache(id);

    res.json({ success: true, data: { message: 'Post deleted' } });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error deleting post', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete post' },
    });
  }
});

// Search posts
router.get('/search', authenticate(false), async (req: AuthenticatedRequest, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Search query is required' },
      });
    }

    const offset = (Number(page) - 1) * Number(limit);

    const countResult = await query(
      `SELECT COUNT(*) FROM posts
       WHERE status = 'published' AND is_private = false
       AND search_vector @@ plainto_tsquery('english', $1)`,
      [q]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `SELECT p.*, u.display_name as author,
              ts_rank(search_vector, plainto_tsquery('english', $1)) as relevance
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       WHERE p.status = 'published' AND p.is_private = false
       AND p.search_vector @@ plainto_tsquery('english', $1)
       ORDER BY relevance DESC, published_at DESC
       LIMIT $2 OFFSET $3`,
      [q, Number(limit), offset]
    );

    const posts = result.rows.map(toPost);

    res.json({
      success: true,
      data: posts,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error searching posts', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to search posts' },
    });
  }
});

export default router;
