import { query } from '../db';
import { mapRow, mapRows } from '../utils/mapRow';
import { NotFoundError } from '../middleware/error';
import { paginatedQuery, findByIdOrThrow, updateById, deleteById, PaginationOptions, PaginatedResult } from './base.repo';
import { sanitize } from '../utils/sanitize';
import type { Page, Block, NavigationItem } from '@surge/shared';

const SANITIZABLE_BLOCK_TYPES = ['rich_text', 'html'];

// ─── Pages ───

export interface PageFilters {
  status?: string;
  search?: string;
}

export async function getNavigation(): Promise<NavigationItem[]> {
  const result = await query(
    `SELECT id, slug, title, show_in_nav, nav_order, is_private
     FROM pages
     WHERE show_in_nav = true AND status = 'published'
     ORDER BY nav_order ASC`
  );
  return result.rows.map((row) => ({
    id: row.id,
    label: row.title,
    slug: row.slug,
    isExternal: false,
    order: row.nav_order,
    isVisible: row.show_in_nav,
    requiresAuth: row.is_private,
  }));
}

export async function findPages(
  filters: PageFilters,
  pagination: PaginationOptions
): Promise<PaginatedResult<Page>> {
  let whereClause = 'WHERE 1=1';
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    whereClause += ` AND status = $${params.length}`;
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    whereClause += ` AND (title ILIKE $${params.length} OR slug ILIKE $${params.length})`;
  }

  return paginatedQuery<Page>(
    `SELECT * FROM pages ${whereClause} ORDER BY nav_order ASC, created_at DESC`,
    `SELECT COUNT(*) FROM pages ${whereClause}`,
    params,
    pagination
  );
}

export async function findPageBySlug(slug: string): Promise<Page | null> {
  const result = await query(
    `SELECT * FROM pages WHERE slug = $1 AND status = 'published'`,
    [slug]
  );
  return result.rows.length > 0 ? mapRow<Page>(result.rows[0]) : null;
}

export async function findPageBySlugAnyStatus(slug: string): Promise<Page | null> {
  const result = await query(
    `SELECT * FROM pages WHERE slug = $1`,
    [slug]
  );
  return result.rows.length > 0 ? mapRow<Page>(result.rows[0]) : null;
}

export async function findPageById(id: string): Promise<Page> {
  return findByIdOrThrow<Page>('pages', id, 'Page');
}

export async function createPage(data: Record<string, unknown>, userId: string): Promise<Page> {
  if (data.isHomepage) {
    await query(`UPDATE pages SET is_homepage = false WHERE is_homepage = true`);
  }

  const result = await query(
    `INSERT INTO pages (slug, title, description, meta_title, meta_description,
                        meta_keywords, og_image, status, is_homepage, show_in_nav,
                        nav_order, is_private, access_level, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
      data.accessLevel || 'public',
      userId,
    ]
  );

  const page = mapRow<Page>(result.rows[0]);
  page.blocks = [];
  return page;
}

export async function updatePage(id: string, data: Record<string, unknown>): Promise<Page> {
  if (data.isHomepage) {
    await query(`UPDATE pages SET is_homepage = false WHERE is_homepage = true AND id != $1`, [id]);
  }
  return updateById<Page>('pages', id, data, 'Page');
}

export async function deletePage(id: string): Promise<void> {
  return deleteById('pages', id, 'Page');
}

// ─── Blocks ───

export async function findBlocksByPageId(pageId: string, visibleOnly = false): Promise<Block[]> {
  const visibleClause = visibleOnly ? 'AND is_visible = true' : '';
  const result = await query(
    `SELECT * FROM blocks WHERE page_id = $1 ${visibleClause} ORDER BY "order" ASC`,
    [pageId]
  );
  return mapRows<Block>(result.rows);
}

export async function createBlock(pageId: string, data: Record<string, unknown>): Promise<Block> {
  // Verify page exists
  await findByIdOrThrow('pages', pageId, 'Page');

  const maxOrder = await query(
    'SELECT COALESCE(MAX("order"), -1) + 1 as next_order FROM blocks WHERE page_id = $1',
    [pageId]
  );

  // Sanitize HTML content for rich_text and html block types
  const content = (typeof data.content === 'string' && SANITIZABLE_BLOCK_TYPES.includes(data.type as string))
    ? sanitize(data.content)
    : data.content;

  const result = await query(
    `INSERT INTO blocks (page_id, type, title, content, settings, "order", is_visible)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      pageId,
      data.type,
      data.title,
      content,
      JSON.stringify(data.settings || {}),
      data.order ?? maxOrder.rows[0].next_order,
      data.isVisible ?? true,
    ]
  );

  return mapRow<Block>(result.rows[0]);
}

export async function updateBlock(pageId: string, blockId: string, data: Record<string, unknown>): Promise<Block> {
  const updates: string[] = [];
  const values: unknown[] = [];

  // Determine the block type for sanitization (use provided type or look up existing)
  const blockType = data.type as string | undefined;

  const fieldMap: Record<string, string> = {
    type: 'type',
    title: 'title',
    content: 'content',
    order: '"order"',
    isVisible: 'is_visible',
  };

  for (const [key, dbCol] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      let value = data[key];
      // Sanitize HTML content for rich_text and html block types
      if (key === 'content' && typeof value === 'string' && blockType && SANITIZABLE_BLOCK_TYPES.includes(blockType)) {
        value = sanitize(value);
      }
      values.push(value);
      updates.push(`${dbCol} = $${values.length}`);
    }
  }

  if (data.settings !== undefined) {
    values.push(JSON.stringify(data.settings));
    updates.push(`settings = $${values.length}`);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
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

  return mapRow<Block>(result.rows[0]);
}

export async function deleteBlock(pageId: string, blockId: string): Promise<void> {
  const result = await query(
    'DELETE FROM blocks WHERE id = $1 AND page_id = $2 RETURNING id',
    [blockId, pageId]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Block');
  }
}

export async function reorderBlocks(pageId: string, blockIds: string[]): Promise<void> {
  for (let i = 0; i < blockIds.length; i++) {
    await query(
      `UPDATE blocks SET "order" = $1, updated_at = NOW() WHERE id = $2 AND page_id = $3`,
      [i, blockIds[i], pageId]
    );
  }
}
