import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { cache } from '../services/cache';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../middleware/error';
import { logger } from '../utils/logger';
import type { Form, FormQuestion, FormSubmission, FormStatus, QuestionType } from '@surge/shared';

const router = Router();

const questionSchema = z.object({
  type: z.enum(['radio', 'checkbox', 'text', 'textarea', 'select', 'number', 'email', 'date']),
  question: z.string().min(1),
  description: z.string().optional(),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().optional(),
  order: z.number().int().optional(),
  validation: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    patternMessage: z.string().optional(),
  }).optional(),
});

const formSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  status: z.enum(['draft', 'published', 'closed', 'archived']).optional(),
  showResults: z.boolean().optional(),
  allowMultipleSubmissions: z.boolean().optional(),
  requiresAuth: z.boolean().optional(),
  successMessage: z.string().optional(),
  questions: z.array(questionSchema).optional(),
});

const submissionSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    value: z.union([z.string(), z.array(z.string()), z.number(), z.boolean()]),
  })),
});

function toForm(row: Record<string, unknown>): Form {
  return {
    id: row.id as string,
    title: row.title as string,
    slug: row.slug as string,
    description: row.description as string | undefined,
    status: row.status as FormStatus,
    showResults: row.show_results as boolean,
    allowMultipleSubmissions: row.allow_multiple_submissions as boolean,
    requiresAuth: row.requires_auth as boolean,
    successMessage: row.success_message as string | undefined,
    questions: [],
    submissionCount: row.submission_count as number,
    createdBy: row.created_by as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    closedAt: row.closed_at ? new Date(row.closed_at as string) : undefined,
  };
}

function toQuestion(row: Record<string, unknown>): FormQuestion {
  return {
    id: row.id as string,
    formId: row.form_id as string,
    type: row.type as QuestionType,
    question: row.question as string,
    description: row.description as string | undefined,
    options: row.options as string[] | undefined,
    isRequired: row.is_required as boolean,
    order: row.order as number,
    validation: row.validation as FormQuestion['validation'],
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// Get published forms (public)
router.get('/public', async (req, res) => {
  try {
    const cacheKey = 'forms:public';

    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const result = await query(
      `SELECT * FROM forms WHERE status = 'published' ORDER BY created_at DESC`
    );

    const forms = result.rows.map(toForm);

    await cache.set(cacheKey, forms, 300);

    res.json({ success: true, data: forms });
  } catch (error) {
    logger.error('Error fetching public forms', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch forms' },
    });
  }
});

// Get form by slug with questions (public)
router.get('/slug/:slug', authenticate(false), async (req: AuthenticatedRequest, res) => {
  try {
    const { slug } = req.params;
    const cacheKey = `form:slug:${slug}`;

    const cached = await cache.get<Form>(cacheKey);
    if (cached && !cached.requiresAuth) {
      return res.json({ success: true, data: cached });
    }

    const formResult = await query(
      `SELECT * FROM forms WHERE slug = $1 AND status = 'published'`,
      [slug]
    );

    if (formResult.rows.length === 0) {
      throw new NotFoundError('Form');
    }

    const formRow = formResult.rows[0];

    if (formRow.requires_auth && !req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const form = toForm(formRow);

    // Get questions
    const questionsResult = await query(
      `SELECT * FROM form_questions WHERE form_id = $1 ORDER BY "order" ASC`,
      [form.id]
    );

    form.questions = questionsResult.rows.map(toQuestion);

    if (!form.requiresAuth) {
      await cache.set(cacheKey, form, 300);
    }

    res.json({ success: true, data: form });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error fetching form', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch form' },
    });
  }
});

// Get form results (public - if showResults is enabled)
router.get('/slug/:slug/results', async (req, res) => {
  try {
    const { slug } = req.params;

    const formResult = await query(
      `SELECT * FROM forms WHERE slug = $1 AND status IN ('published', 'closed') AND show_results = true`,
      [slug]
    );

    if (formResult.rows.length === 0) {
      throw new NotFoundError('Form or results not available');
    }

    const form = toForm(formResult.rows[0]);

    const questionsResult = await query(
      `SELECT * FROM form_questions WHERE form_id = $1 ORDER BY "order" ASC`,
      [form.id]
    );

    const questions = questionsResult.rows.map(toQuestion);

    // Get submissions
    const submissionsResult = await query(
      `SELECT answers FROM form_submissions WHERE form_id = $1`,
      [form.id]
    );

    // Calculate results for each question
    const questionResults = questions.map((q) => {
      const answers = submissionsResult.rows
        .map((row) => {
          const ans = (row.answers as Array<{ questionId: string; value: unknown }>)
            .find((a) => a.questionId === q.id);
          return ans?.value;
        })
        .filter((v) => v !== undefined);

      let summary;

      if (['radio', 'checkbox', 'select'].includes(q.type) && q.options) {
        const counts: Record<string, number> = {};
        q.options.forEach((opt) => { counts[opt] = 0; });

        answers.forEach((ans) => {
          if (Array.isArray(ans)) {
            ans.forEach((a) => { if (counts[a] !== undefined) counts[a]++; });
          } else if (typeof ans === 'string' && counts[ans] !== undefined) {
            counts[ans]++;
          }
        });

        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        summary = {
          type: 'choice' as const,
          options: Object.entries(counts).map(([value, count]) => ({
            value,
            count,
            percentage: total > 0 ? (count / total) * 100 : 0,
          })),
        };
      } else if (q.type === 'number') {
        const nums = answers.filter((a): a is number => typeof a === 'number');
        if (nums.length > 0) {
          const sorted = [...nums].sort((a, b) => a - b);
          summary = {
            type: 'number' as const,
            min: Math.min(...nums),
            max: Math.max(...nums),
            average: nums.reduce((a, b) => a + b, 0) / nums.length,
            median: sorted[Math.floor(sorted.length / 2)],
          };
        } else {
          summary = { type: 'number' as const, min: 0, max: 0, average: 0, median: 0 };
        }
      } else {
        const texts = answers.filter((a): a is string => typeof a === 'string');
        summary = {
          type: 'text' as const,
          sampleResponses: texts.slice(0, 5),
          totalResponses: texts.length,
        };
      }

      return {
        questionId: q.id,
        question: q.question,
        type: q.type,
        responses: answers.length,
        summary,
      };
    });

    res.json({
      success: true,
      data: {
        formId: form.id,
        totalSubmissions: form.submissionCount,
        questionResults,
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error fetching form results', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch results' },
    });
  }
});

// Submit form (public)
router.post('/slug/:slug/submit', authenticate(false), async (req: AuthenticatedRequest, res) => {
  try {
    const { slug } = req.params;
    const data = submissionSchema.parse(req.body);

    const formResult = await query(
      `SELECT * FROM forms WHERE slug = $1 AND status = 'published'`,
      [slug]
    );

    if (formResult.rows.length === 0) {
      throw new NotFoundError('Form');
    }

    const form = toForm(formResult.rows[0]);

    if (form.requiresAuth && !req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    // Check for duplicate submissions
    if (!form.allowMultipleSubmissions) {
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;
      const existing = await query(
        `SELECT id FROM form_submissions WHERE form_id = $1 AND (user_id = $2 OR ip_address = $3)`,
        [form.id, req.userId || null, ipAddress]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: { code: 'CONFLICT', message: 'You have already submitted this form' },
        });
      }
    }

    // Get questions and validate required fields
    const questionsResult = await query(
      `SELECT * FROM form_questions WHERE form_id = $1`,
      [form.id]
    );

    const questions = questionsResult.rows.map(toQuestion);
    const requiredQuestions = questions.filter((q) => q.isRequired);

    for (const rq of requiredQuestions) {
      const answer = data.answers.find((a) => a.questionId === rq.id);
      if (!answer || answer.value === '' || (Array.isArray(answer.value) && answer.value.length === 0)) {
        throw new ValidationError(`Question "${rq.question}" is required`);
      }
    }

    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;
    const userAgent = req.headers['user-agent'];

    await query(
      `INSERT INTO form_submissions (form_id, user_id, ip_address, user_agent, answers)
       VALUES ($1, $2, $3, $4, $5)`,
      [form.id, req.userId || null, ipAddress, userAgent, JSON.stringify(data.answers)]
    );

    await cache.invalidateFormCache(form.id);

    res.status(201).json({
      success: true,
      data: {
        message: form.successMessage || 'Form submitted successfully',
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      return res.status(error instanceof NotFoundError ? 404 : 400).json({
        success: false,
        error: { code: error instanceof NotFoundError ? 'NOT_FOUND' : 'VALIDATION_ERROR', message: error.message },
      });
    }
    logger.error('Error submitting form', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to submit form' },
    });
  }
});

// Admin routes

// Get all forms (admin)
router.get('/', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }

    const countResult = await query(`SELECT COUNT(*) FROM forms ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(Number(limit), offset);
    const result = await query(
      `SELECT * FROM forms ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const forms = result.rows.map(toForm);

    res.json({
      success: true,
      data: forms,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error fetching forms', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch forms' },
    });
  }
});

// Get form by ID (admin)
router.get('/:id', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const formResult = await query('SELECT * FROM forms WHERE id = $1', [id]);

    if (formResult.rows.length === 0) {
      throw new NotFoundError('Form');
    }

    const form = toForm(formResult.rows[0]);

    const questionsResult = await query(
      `SELECT * FROM form_questions WHERE form_id = $1 ORDER BY "order" ASC`,
      [form.id]
    );

    form.questions = questionsResult.rows.map(toQuestion);

    res.json({ success: true, data: form });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error fetching form', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch form' },
    });
  }
});

// Get form submissions (admin)
router.get('/:id/submissions', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const countResult = await query(
      `SELECT COUNT(*) FROM form_submissions WHERE form_id = $1`,
      [id]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `SELECT fs.*, u.display_name as user_name, u.email as user_email
       FROM form_submissions fs
       LEFT JOIN users u ON fs.user_id = u.id
       WHERE fs.form_id = $1
       ORDER BY fs.submitted_at DESC
       LIMIT $2 OFFSET $3`,
      [id, Number(limit), offset]
    );

    const submissions = result.rows.map((row) => ({
      id: row.id,
      formId: row.form_id,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      ipAddress: row.ip_address,
      answers: row.answers,
      submittedAt: row.submitted_at,
    }));

    res.json({
      success: true,
      data: submissions,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Error fetching form submissions', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch submissions' },
    });
  }
});

// Create form (admin)
router.post('/', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const data = formSchema.parse(req.body);

    const formResult = await query(
      `INSERT INTO forms (title, slug, description, status, show_results,
                          allow_multiple_submissions, requires_auth, success_message, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.title,
        data.slug,
        data.description,
        data.status || 'draft',
        data.showResults ?? false,
        data.allowMultipleSubmissions ?? false,
        data.requiresAuth ?? false,
        data.successMessage,
        req.userId,
      ]
    );

    const form = toForm(formResult.rows[0]);

    // Create questions if provided
    if (data.questions && data.questions.length > 0) {
      for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i];
        const questionResult = await query(
          `INSERT INTO form_questions (form_id, type, question, description, options,
                                       is_required, "order", validation)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            form.id,
            q.type,
            q.question,
            q.description,
            q.options || null,
            q.isRequired ?? false,
            q.order ?? i,
            q.validation ? JSON.stringify(q.validation) : null,
          ]
        );
        form.questions.push(toQuestion(questionResult.rows[0]));
      }
    }

    await cache.invalidateFormCache();

    res.status(201).json({ success: true, data: form });
  } catch (error) {
    logger.error('Error creating form', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create form' },
    });
  }
});

// Update form (admin)
router.put('/:id', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const data = formSchema.partial().parse(req.body);

    const existing = await query('SELECT id FROM forms WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new NotFoundError('Form');
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.title !== undefined) {
      values.push(data.title);
      updates.push(`title = $${values.length}`);
    }
    if (data.slug !== undefined) {
      values.push(data.slug);
      updates.push(`slug = $${values.length}`);
    }
    if (data.description !== undefined) {
      values.push(data.description);
      updates.push(`description = $${values.length}`);
    }
    if (data.status !== undefined) {
      values.push(data.status);
      updates.push(`status = $${values.length}`);
      if (data.status === 'closed') {
        values.push(new Date().toISOString());
        updates.push(`closed_at = $${values.length}`);
      }
    }
    if (data.showResults !== undefined) {
      values.push(data.showResults);
      updates.push(`show_results = $${values.length}`);
    }
    if (data.allowMultipleSubmissions !== undefined) {
      values.push(data.allowMultipleSubmissions);
      updates.push(`allow_multiple_submissions = $${values.length}`);
    }
    if (data.requiresAuth !== undefined) {
      values.push(data.requiresAuth);
      updates.push(`requires_auth = $${values.length}`);
    }
    if (data.successMessage !== undefined) {
      values.push(data.successMessage);
      updates.push(`success_message = $${values.length}`);
    }

    if (updates.length > 0) {
      values.push(id);
      await query(
        `UPDATE forms SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`,
        values
      );
    }

    await cache.invalidateFormCache(id);

    // Fetch updated form
    const formResult = await query('SELECT * FROM forms WHERE id = $1', [id]);
    const form = toForm(formResult.rows[0]);

    const questionsResult = await query(
      `SELECT * FROM form_questions WHERE form_id = $1 ORDER BY "order" ASC`,
      [form.id]
    );
    form.questions = questionsResult.rows.map(toQuestion);

    res.json({ success: true, data: form });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error updating form', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update form' },
    });
  }
});

// Add question to form (admin)
router.post('/:id/questions', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const data = questionSchema.parse(req.body);

    const formExists = await query('SELECT id FROM forms WHERE id = $1', [id]);
    if (formExists.rows.length === 0) {
      throw new NotFoundError('Form');
    }

    const maxOrder = await query(
      'SELECT COALESCE(MAX("order"), -1) + 1 as next_order FROM form_questions WHERE form_id = $1',
      [id]
    );

    const result = await query(
      `INSERT INTO form_questions (form_id, type, question, description, options,
                                   is_required, "order", validation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        data.type,
        data.question,
        data.description,
        data.options || null,
        data.isRequired ?? false,
        data.order ?? maxOrder.rows[0].next_order,
        data.validation ? JSON.stringify(data.validation) : null,
      ]
    );

    await cache.invalidateFormCache(id);

    res.status(201).json({ success: true, data: toQuestion(result.rows[0]) });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error adding question', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to add question' },
    });
  }
});

// Update question (admin)
router.put('/:formId/questions/:questionId', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { formId, questionId } = req.params;
    const data = questionSchema.partial().parse(req.body);

    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.type !== undefined) {
      values.push(data.type);
      updates.push(`type = $${values.length}`);
    }
    if (data.question !== undefined) {
      values.push(data.question);
      updates.push(`question = $${values.length}`);
    }
    if (data.description !== undefined) {
      values.push(data.description);
      updates.push(`description = $${values.length}`);
    }
    if (data.options !== undefined) {
      values.push(data.options);
      updates.push(`options = $${values.length}`);
    }
    if (data.isRequired !== undefined) {
      values.push(data.isRequired);
      updates.push(`is_required = $${values.length}`);
    }
    if (data.order !== undefined) {
      values.push(data.order);
      updates.push(`"order" = $${values.length}`);
    }
    if (data.validation !== undefined) {
      values.push(JSON.stringify(data.validation));
      updates.push(`validation = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'No fields to update' },
      });
    }

    values.push(questionId, formId);
    const result = await query(
      `UPDATE form_questions SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length - 1} AND form_id = $${values.length}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Question');
    }

    await cache.invalidateFormCache(formId);

    res.json({ success: true, data: toQuestion(result.rows[0]) });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error updating question', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update question' },
    });
  }
});

// Delete question (admin)
router.delete('/:formId/questions/:questionId', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { formId, questionId } = req.params;

    const result = await query(
      'DELETE FROM form_questions WHERE id = $1 AND form_id = $2 RETURNING id',
      [questionId, formId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Question');
    }

    await cache.invalidateFormCache(formId);

    res.json({ success: true, data: { message: 'Question deleted' } });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error deleting question', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete question' },
    });
  }
});

// Delete form (admin)
router.delete('/:id', authenticate(), requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM forms WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Form');
    }

    await cache.invalidateFormCache(id);

    res.json({ success: true, data: { message: 'Form deleted' } });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    logger.error('Error deleting form', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete form' },
    });
  }
});

export default router;
