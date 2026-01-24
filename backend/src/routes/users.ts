import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { query } from '../db';
import { cache } from '../services/cache';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { NotFoundError } from '../middleware/error';
import { logger } from '../utils/logger';
import type { User, UserRole, UserBan } from '@surge/shared';

const router = Router();

const updateUserSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  role: z.enum(['anonymous', 'member', 'admin']).optional(),
  isActive: z.boolean().optional(),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(255),
  role: z.enum(['member', 'admin']).optional(),
});

const banUserSchema = z.object({
  email: z.string().email().optional(),
  ipAddress: z.string().optional(),
  reason: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

function toUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    displayName: row.display_name as string,
    avatarUrl: row.avatar_url as string | undefined,
    role: row.role as UserRole,
    authProvider: row.auth_provider as 'patreon' | 'email',
    patreonId: row.patreon_id as string | undefined,
    patreonTier: row.patreon_tier as string | undefined,
    isActive: row.is_active as boolean,
    isBanned: row.is_banned as boolean,
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at as string) : undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// Get all users (admin)
router.get('/', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { search, role, status, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (email ILIKE $${params.length} OR display_name ILIKE $${params.length})`;
    }

    if (role) {
      params.push(role);
      whereClause += ` AND role = $${params.length}`;
    }

    if (status === 'active') {
      whereClause += ` AND is_active = true AND is_banned = false`;
    } else if (status === 'banned') {
      whereClause += ` AND is_banned = true`;
    } else if (status === 'inactive') {
      whereClause += ` AND is_active = false`;
    }

    const countResult = await query(`SELECT COUNT(*) FROM users ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(Number(limit), offset);
    const result = await query(
      `SELECT * FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const users = result.rows.map(toUser);

    res.json({
      success: true,
      data: users,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error fetching users', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch users' },
    });
  }
});

// Get user by ID (admin)
router.get('/:id', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM users WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('User');
    }

    const user = toUser(result.rows[0]);

    // Get Patreon membership info if available
    let membership = null;
    if (user.patreonId) {
      const membershipResult = await query(
        'SELECT * FROM patreon_memberships WHERE user_id = $1',
        [user.id]
      );
      if (membershipResult.rows.length > 0) {
        membership = membershipResult.rows[0];
      }
    }

    res.json({ success: true, data: { user, membership } });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error fetching user', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch user' },
    });
  }
});

// Create user (admin - for email/password users)
router.post('/', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const data = createUserSchema.parse(req.body);

    const passwordHash = await bcrypt.hash(data.password, 12);

    const result = await query(
      `INSERT INTO users (email, password_hash, display_name, role, auth_provider)
       VALUES ($1, $2, $3, $4, 'email')
       RETURNING *`,
      [data.email, passwordHash, data.displayName, data.role || 'member']
    );

    const user = toUser(result.rows[0]);

    res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid data', details: error.errors },
      });
    }
    if (error?.code === '23505') {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE', message: 'A user with this email already exists' },
      });
    }
    logger.error('Error creating user', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create user' },
    });
  }
});

// Update user (admin)
router.put('/:id', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateUserSchema.parse(req.body);

    const existing = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new NotFoundError('User');
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.displayName !== undefined) {
      values.push(data.displayName);
      updates.push(`display_name = $${values.length}`);
    }
    if (data.role !== undefined) {
      values.push(data.role);
      updates.push(`role = $${values.length}`);
    }
    if (data.isActive !== undefined) {
      values.push(data.isActive);
      updates.push(`is_active = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.json({ success: true, data: toUser(existing.rows[0]) });
    }

    values.push(id);
    const result = await query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    await cache.invalidateUserCache(id);

    const user = toUser(result.rows[0]);

    res.json({ success: true, data: user });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error updating user', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update user' },
    });
  }
});

// Ban user (admin)
router.post('/:id/ban', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { reason, expiresAt } = banUserSchema.parse(req.body);

    const userResult = await query('SELECT email FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      throw new NotFoundError('User');
    }

    const email = userResult.rows[0].email;

    // Update user
    await query(
      'UPDATE users SET is_banned = true, updated_at = NOW() WHERE id = $1',
      [id]
    );

    // Create ban record
    await query(
      `INSERT INTO users_banned (email, reason, banned_by, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [email, reason, req.userId, expiresAt]
    );

    // Invalidate user sessions
    await query('DELETE FROM user_sessions WHERE user_id = $1', [id]);

    await cache.invalidateUserCache(id);

    res.json({ success: true, data: { message: 'User banned successfully' } });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error banning user', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to ban user' },
    });
  }
});

// Unban user (admin)
router.post('/:id/unban', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const userResult = await query('SELECT email FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      throw new NotFoundError('User');
    }

    const email = userResult.rows[0].email;

    // Update user
    await query(
      'UPDATE users SET is_banned = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    // Remove ban records
    await query('DELETE FROM users_banned WHERE email = $1', [email]);

    await cache.invalidateUserCache(id);

    res.json({ success: true, data: { message: 'User unbanned successfully' } });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error unbanning user', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to unban user' },
    });
  }
});

// Ban IP address (admin)
router.post('/ban-ip', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const data = banUserSchema.parse(req.body);

    if (!data.ipAddress) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'IP address is required' },
      });
    }

    await query(
      `INSERT INTO users_banned (ip_address, reason, banned_by, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [data.ipAddress, data.reason, req.userId, data.expiresAt]
    );

    res.json({ success: true, data: { message: 'IP address banned' } });
  } catch (error) {
    logger.error('Error banning IP', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to ban IP address' },
    });
  }
});

// Get banned list (admin)
router.get('/banned/list', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const countResult = await query('SELECT COUNT(*) FROM users_banned');
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `SELECT ub.*, u.display_name as banned_by_name
       FROM users_banned ub
       LEFT JOIN users u ON ub.banned_by = u.id
       ORDER BY ub.created_at DESC
       LIMIT $1 OFFSET $2`,
      [Number(limit), offset]
    );

    const bans = result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      ipAddress: row.ip_address,
      reason: row.reason,
      bannedBy: row.banned_by,
      bannedByName: row.banned_by_name,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));

    res.json({
      success: true,
      data: bans,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error fetching banned list', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch banned list' },
    });
  }
});

// Remove ban (admin)
router.delete('/banned/:banId', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { banId } = req.params;

    const result = await query(
      'DELETE FROM users_banned WHERE id = $1 RETURNING email',
      [banId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Ban');
    }

    // If it was an email ban, update the user
    if (result.rows[0].email) {
      await query(
        'UPDATE users SET is_banned = false WHERE email = $1',
        [result.rows[0].email]
      );
    }

    res.json({ success: true, data: { message: 'Ban removed' } });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error removing ban', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to remove ban' },
    });
  }
});

export default router;
