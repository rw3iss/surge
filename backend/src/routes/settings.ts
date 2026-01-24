import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { cache } from '../services/cache';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import type { SiteSettings } from '@surge/shared';

const router = Router();

const settingsSchema = z.object({
  siteName: z.string().min(1).max(255).optional(),
  siteDescription: z.string().optional(),
  logo: z.string().url().optional().nullable(),
  favicon: z.string().url().optional().nullable(),
  socialLinks: z.record(z.string()).optional(),
  contactEmail: z.string().email().optional(),
  analytics: z.object({
    googleAnalyticsId: z.string().optional(),
    facebookPixelId: z.string().optional(),
  }).optional(),
  theme: z.object({
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    accentColor: z.string().optional(),
  }).optional(),
});

// Get public settings (public)
router.get('/public', async (req, res) => {
  try {
    const cacheKey = 'settings:public';

    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const result = await query(`SELECT key, value FROM site_settings`);

    const settings: Record<string, unknown> = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }

    const publicSettings: SiteSettings = {
      siteName: (settings.site_name as string) || 'Surge Media',
      siteDescription: (settings.site_description as string) || '',
      logo: settings.logo as string | undefined,
      favicon: settings.favicon as string | undefined,
      socialLinks: (settings.social_links as Record<string, string>) || {},
      contactEmail: (settings.contact_email as string) || '',
      analytics: settings.analytics as SiteSettings['analytics'],
      theme: settings.theme as SiteSettings['theme'],
    };

    await cache.set(cacheKey, publicSettings, 600);

    res.json({ success: true, data: publicSettings });
  } catch (error) {
    logger.error('Error fetching public settings', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch settings' },
    });
  }
});

// Get all settings (admin)
router.get('/', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await query(
      `SELECT key, value, updated_at, u.display_name as updated_by_name
       FROM site_settings s
       LEFT JOIN users u ON s.updated_by = u.id`
    );

    const settings: Record<string, { value: unknown; updatedAt: Date; updatedBy?: string }> = {};
    for (const row of result.rows) {
      settings[row.key] = {
        value: row.value,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by_name,
      };
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error('Error fetching settings', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch settings' },
    });
  }
});

// Update settings (admin)
router.put('/', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const data = settingsSchema.parse(req.body);

    const settingsMap: Record<string, unknown> = {
      site_name: data.siteName,
      site_description: data.siteDescription,
      logo: data.logo,
      favicon: data.favicon,
      social_links: data.socialLinks,
      contact_email: data.contactEmail,
      analytics: data.analytics,
      theme: data.theme,
    };

    for (const [key, value] of Object.entries(settingsMap)) {
      if (value !== undefined) {
        await query(
          `INSERT INTO site_settings (key, value, updated_by)
           VALUES ($1, $2, $3)
           ON CONFLICT (key) DO UPDATE SET
             value = EXCLUDED.value,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()`,
          [key, JSON.stringify(value), req.userId]
        );
      }
    }

    await cache.invalidateSettingsCache();

    res.json({ success: true, data: { message: 'Settings updated' } });
  } catch (error) {
    logger.error('Error updating settings', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update settings' },
    });
  }
});

// Update single setting (admin)
router.put('/:key', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Value is required' },
      });
    }

    await query(
      `INSERT INTO site_settings (key, value, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [key, JSON.stringify(value), req.userId]
    );

    await cache.invalidateSettingsCache();

    res.json({ success: true, data: { message: 'Setting updated' } });
  } catch (error) {
    logger.error('Error updating setting', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update setting' },
    });
  }
});

// Delete setting (admin)
router.delete('/:key', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { key } = req.params;

    await query('DELETE FROM site_settings WHERE key = $1', [key]);

    await cache.invalidateSettingsCache();

    res.json({ success: true, data: { message: 'Setting deleted' } });
  } catch (error) {
    logger.error('Error deleting setting', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete setting' },
    });
  }
});

export default router;
