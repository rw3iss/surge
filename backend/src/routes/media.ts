import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import sharp from 'sharp';
import { nanoid } from 'nanoid';
import { query } from '../db';
import { config } from '../config';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../middleware/error';
import { logger } from '../utils/logger';
import { getStorageProvider } from '../services/storage';
import type { Media } from '@surge/shared';

const router = Router();

// When using local storage, write directly to uploads dir.
// For remote providers (S3, etc.), use a temp directory.
const multerDestDir = config.upload.storageProvider === 'local'
  ? config.upload.dir
  : path.join(os.tmpdir(), 'surge-uploads');

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await fs.mkdir(multerDestDir, { recursive: true });
      cb(null, multerDestDir);
    } catch (error) {
      cb(error as Error, multerDestDir);
    }
  },
  filename: (_req, file, cb) => {
    const uniqueId = nanoid(12);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxSizeMb * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (config.upload.allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ValidationError(`File type ${file.mimetype} is not allowed`));
    }
  },
});

function toMedia(row: Record<string, unknown>): Media {
  return {
    id: row.id as string,
    filename: row.filename as string,
    originalName: row.original_name as string,
    mimeType: row.mime_type as string,
    size: row.size as number,
    url: row.url as string,
    thumbnailUrl: row.thumbnail_url as string | undefined,
    alt: row.alt as string | undefined,
    caption: row.caption as string | undefined,
    uploadedBy: row.uploaded_by as string,
    createdAt: new Date(row.created_at as string),
  };
}

async function createThumbnail(
  filePath: string,
  thumbnailPath: string,
  width = 300
): Promise<void> {
  await sharp(filePath)
    .resize(width, null, { withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(thumbnailPath);
}

async function cleanupTemp(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore cleanup failures
  }
}

// Upload file (admin)
router.post('/', authenticate(), requireAdmin, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  let tempFilePath: string | undefined;
  let tempThumbPath: string | undefined;

  try {
    if (!req.file) {
      throw new ValidationError('No file provided');
    }

    const { alt, caption } = req.body;
    const file = req.file;
    tempFilePath = file.path;

    const storageProvider = getStorageProvider();
    const uploadOptions = {
      filename: file.filename,
      mimeType: file.mimetype,
      originalName: file.originalname,
    };

    // Upload main file to storage
    const url = await storageProvider.upload(file.path, uploadOptions);

    // Create and upload thumbnail for images
    let thumbnailUrl: string | undefined;
    if (file.mimetype.startsWith('image/') && !file.mimetype.includes('gif')) {
      tempThumbPath = path.join(multerDestDir, `thumb_${file.filename}`);
      try {
        await createThumbnail(file.path, tempThumbPath);
        thumbnailUrl = await storageProvider.uploadThumbnail(tempThumbPath, uploadOptions);
      } catch (thumbError) {
        logger.warn('Failed to create thumbnail', { error: thumbError });
      }
    }

    const result = await query(
      `INSERT INTO media (filename, original_name, mime_type, size, url, thumbnail_url, alt, caption, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        file.filename,
        file.originalname,
        file.mimetype,
        file.size,
        url,
        thumbnailUrl,
        alt,
        caption,
        req.userId,
      ]
    );

    const media = toMedia(result.rows[0]);

    // Cleanup temp files if using non-local storage
    if (config.upload.storageProvider !== 'local') {
      if (tempFilePath) await cleanupTemp(tempFilePath);
      if (tempThumbPath) await cleanupTemp(tempThumbPath);
    }

    res.status(201).json({ success: true, data: media });
  } catch (error) {
    // Cleanup temp files on error
    if (tempFilePath) await cleanupTemp(tempFilePath);
    if (tempThumbPath) await cleanupTemp(tempThumbPath);

    logger.error('Error uploading file', { error });
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.message },
      });
    }
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to upload file' },
    });
  }
});

// Upload file for content block (admin)
router.post('/block-upload', authenticate(), requireAdmin, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  let tempFilePath: string | undefined;
  let tempThumbPath: string | undefined;

  try {
    if (!req.file) {
      throw new ValidationError('No file provided');
    }

    const { postId, blockId } = req.body;
    const file = req.file;
    tempFilePath = file.path;

    const storageProvider = getStorageProvider();
    const uploadOptions = {
      filename: file.filename,
      mimeType: file.mimetype,
      originalName: file.originalname,
    };

    // Upload main file to storage
    const url = await storageProvider.upload(file.path, uploadOptions);

    // Create and upload thumbnail for images
    let thumbnailUrl: string | undefined;
    if (file.mimetype.startsWith('image/') && !file.mimetype.includes('gif')) {
      tempThumbPath = path.join(multerDestDir, `thumb_${file.filename}`);
      try {
        await createThumbnail(file.path, tempThumbPath);
        thumbnailUrl = await storageProvider.uploadThumbnail(tempThumbPath, uploadOptions);
      } catch (thumbError) {
        logger.warn('Failed to create thumbnail', { error: thumbError });
      }
    }

    // Store in media table with optional block association
    const result = await query(
      `INSERT INTO media (filename, original_name, mime_type, size, url, thumbnail_url, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        file.filename,
        file.originalname,
        file.mimetype,
        file.size,
        url,
        thumbnailUrl,
        req.userId,
      ]
    );

    const media = toMedia(result.rows[0]);

    // Cleanup temp files if using non-local storage
    if (config.upload.storageProvider !== 'local') {
      if (tempFilePath) await cleanupTemp(tempFilePath);
      if (tempThumbPath) await cleanupTemp(tempThumbPath);
    }

    res.status(201).json({
      success: true,
      data: {
        ...media,
        postId: postId || null,
        blockId: blockId || null,
      },
    });
  } catch (error) {
    if (tempFilePath) await cleanupTemp(tempFilePath);
    if (tempThumbPath) await cleanupTemp(tempThumbPath);

    logger.error('Error uploading block file', { error });
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.message },
      });
    }
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to upload file' },
    });
  }
});

// Upload multiple files (admin)
router.post('/bulk', authenticate(), requireAdmin, upload.array('files', 10), async (req: AuthenticatedRequest, res) => {
  const tempFiles: string[] = [];

  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new ValidationError('No files provided');
    }

    const storageProvider = getStorageProvider();
    const mediaItems: Media[] = [];

    for (const file of files) {
      tempFiles.push(file.path);
      const uploadOptions = {
        filename: file.filename,
        mimeType: file.mimetype,
        originalName: file.originalname,
      };

      const url = await storageProvider.upload(file.path, uploadOptions);

      let thumbnailUrl: string | undefined;
      if (file.mimetype.startsWith('image/') && !file.mimetype.includes('gif')) {
        const tempThumbPath = path.join(multerDestDir, `thumb_${file.filename}`);
        tempFiles.push(tempThumbPath);
        try {
          await createThumbnail(file.path, tempThumbPath);
          thumbnailUrl = await storageProvider.uploadThumbnail(tempThumbPath, uploadOptions);
        } catch {
          // Continue without thumbnail
        }
      }

      const result = await query(
        `INSERT INTO media (filename, original_name, mime_type, size, url, thumbnail_url, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [file.filename, file.originalname, file.mimetype, file.size, url, thumbnailUrl, req.userId]
      );

      mediaItems.push(toMedia(result.rows[0]));
    }

    // Cleanup temp files if using non-local storage
    if (config.upload.storageProvider !== 'local') {
      for (const f of tempFiles) await cleanupTemp(f);
    }

    res.status(201).json({ success: true, data: mediaItems });
  } catch (error) {
    if (config.upload.storageProvider !== 'local') {
      for (const f of tempFiles) await cleanupTemp(f);
    }
    logger.error('Error uploading files', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to upload files' },
    });
  }
});

// Get all media (admin)
router.get('/', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { type, search, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (type) {
      params.push(`${type}/%`);
      whereClause += ` AND mime_type LIKE $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (original_name ILIKE $${params.length} OR alt ILIKE $${params.length} OR caption ILIKE $${params.length})`;
    }

    const countResult = await query(`SELECT COUNT(*) FROM media ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(Number(limit), offset);
    const result = await query(
      `SELECT * FROM media ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const media = result.rows.map(toMedia);

    res.json({
      success: true,
      data: media,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error fetching media', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch media' },
    });
  }
});

// Get media by ID (admin)
router.get('/:id', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM media WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Media');
    }

    const media = toMedia(result.rows[0]);

    res.json({ success: true, data: media });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error fetching media', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch media' },
    });
  }
});

// Update media metadata (admin)
router.put('/:id', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { alt, caption } = req.body;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (alt !== undefined) {
      values.push(alt);
      updates.push(`alt = $${values.length}`);
    }
    if (caption !== undefined) {
      values.push(caption);
      updates.push(`caption = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'No fields to update' },
      });
    }

    values.push(id);
    const result = await query(
      `UPDATE media SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Media');
    }

    const media = toMedia(result.rows[0]);

    res.json({ success: true, data: media });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error updating media', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update media' },
    });
  }
});

// Delete media (admin)
router.delete('/:id', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM media WHERE id = $1 RETURNING filename, thumbnail_url',
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Media');
    }

    const { filename, thumbnail_url } = result.rows[0];
    const storageProvider = getStorageProvider();

    await storageProvider.delete(filename);
    if (thumbnail_url) {
      await storageProvider.deleteThumbnail(filename);
    }

    res.json({ success: true, data: { message: 'Media deleted' } });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error deleting media', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete media' },
    });
  }
});

export default router;
