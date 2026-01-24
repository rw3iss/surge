import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { NotFoundError } from '../middleware/error';
import { sendEmail } from '../services/email';
import { logger } from '../utils/logger';
import { config } from '../config';
import type { ContactMessage, MessageStatus } from '@surge/shared';

const router = Router();

const messageSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  subject: z.string().max(255).optional(),
  message: z.string().min(1).max(5000),
});

const updateStatusSchema = z.object({
  status: z.enum(['unread', 'read', 'replied', 'archived', 'spam']),
});

function toMessage(row: Record<string, unknown>): ContactMessage {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    subject: row.subject as string | undefined,
    message: row.message as string,
    userId: row.user_id as string | undefined,
    ipAddress: row.ip_address as string,
    userAgent: row.user_agent as string | undefined,
    status: row.status as MessageStatus,
    repliedAt: row.replied_at ? new Date(row.replied_at as string) : undefined,
    repliedBy: row.replied_by as string | undefined,
    createdAt: new Date(row.created_at as string),
  };
}

// Submit contact message (public)
router.post('/', authenticate(false), async (req: AuthenticatedRequest, res) => {
  try {
    const data = messageSchema.parse(req.body);

    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await query(
      `INSERT INTO contact_messages (name, email, subject, message, user_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [data.name, data.email, data.subject, data.message, req.userId || null, ipAddress, userAgent]
    );

    // Send email notification to admin
    try {
      await sendEmail({
        to: config.adminEmails[0] || config.email.from || 'admin@surgemedia.us',
        subject: `New Contact Message: ${data.subject || 'No Subject'}`,
        html: `
          <h2>New Contact Message</h2>
          <p><strong>From:</strong> ${data.name} (${data.email})</p>
          <p><strong>Subject:</strong> ${data.subject || 'No Subject'}</p>
          <p><strong>Message:</strong></p>
          <p>${data.message.replace(/\n/g, '<br>')}</p>
          <hr>
          <p><small>IP: ${ipAddress}</small></p>
        `,
      });
    } catch (emailError) {
      logger.warn('Failed to send email notification', { error: emailError });
    }

    res.status(201).json({
      success: true,
      data: { message: 'Message sent successfully' },
    });
  } catch (error) {
    logger.error('Error submitting contact message', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to send message' },
    });
  }
});

// Get all messages (admin)
router.get('/', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR subject ILIKE $${params.length} OR message ILIKE $${params.length})`;
    }

    const countResult = await query(`SELECT COUNT(*) FROM contact_messages ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(Number(limit), offset);
    const result = await query(
      `SELECT * FROM contact_messages ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const messages = result.rows.map(toMessage);

    // Get unread count
    const unreadResult = await query(
      `SELECT COUNT(*) FROM contact_messages WHERE status = 'unread'`
    );
    const unreadCount = parseInt(unreadResult.rows[0].count, 10);

    res.json({
      success: true,
      data: messages,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
        unreadCount,
      },
    });
  } catch (error) {
    logger.error('Error fetching messages', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch messages' },
    });
  }
});

// Get message by ID (admin)
router.get('/:id', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM contact_messages WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Message');
    }

    // Mark as read if unread
    if (result.rows[0].status === 'unread') {
      await query(
        `UPDATE contact_messages SET status = 'read' WHERE id = $1`,
        [id]
      );
      result.rows[0].status = 'read';
    }

    const message = toMessage(result.rows[0]);

    res.json({ success: true, data: message });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error fetching message', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch message' },
    });
  }
});

// Update message status (admin)
router.put('/:id/status', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = updateStatusSchema.parse(req.body);

    const updates: string[] = [`status = $1`];
    const values: unknown[] = [status];

    if (status === 'replied') {
      values.push(new Date().toISOString());
      updates.push(`replied_at = $${values.length}`);
      values.push(req.userId);
      updates.push(`replied_by = $${values.length}`);
    }

    values.push(id);
    const result = await query(
      `UPDATE contact_messages SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Message');
    }

    const message = toMessage(result.rows[0]);

    res.json({ success: true, data: message });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error updating message status', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update message' },
    });
  }
});

// Delete message (admin)
router.delete('/:id', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM contact_messages WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Message');
    }

    res.json({ success: true, data: { message: 'Message deleted' } });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error deleting message', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete message' },
    });
  }
});

// Bulk update status (admin)
router.post('/bulk-status', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { messageIds, status } = z.object({
      messageIds: z.array(z.string().uuid()),
      status: z.enum(['unread', 'read', 'replied', 'archived', 'spam']),
    }).parse(req.body);

    await query(
      `UPDATE contact_messages SET status = $1 WHERE id = ANY($2)`,
      [status, messageIds]
    );

    res.json({ success: true, data: { message: `${messageIds.length} messages updated` } });
  } catch (error) {
    logger.error('Error bulk updating messages', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update messages' },
    });
  }
});

// Bulk delete (admin)
router.post('/bulk-delete', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { messageIds } = z.object({
      messageIds: z.array(z.string().uuid()),
    }).parse(req.body);

    await query(
      `DELETE FROM contact_messages WHERE id = ANY($1)`,
      [messageIds]
    );

    res.json({ success: true, data: { message: `${messageIds.length} messages deleted` } });
  } catch (error) {
    logger.error('Error bulk deleting messages', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete messages' },
    });
  }
});

export default router;
