import { Router, Response } from 'express';
import { z } from 'zod';
import { config } from '../config';
import {
  getPatreonAuthUrl,
  authenticateWithPatreon,
  authenticateWithEmail,
  refreshTokens,
  invalidateSession,
  invalidateAllUserSessions,
  generateState,
} from '../services/auth';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

// Get Patreon auth URL
router.get('/patreon', (req, res) => {
  const state = generateState();

  // Store state in session or return to client
  res.json({
    success: true,
    data: {
      authUrl: getPatreonAuthUrl(state),
      state,
    },
  });
});

// Patreon OAuth callback
router.get('/patreon/callback', async (req, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      logger.warn('Patreon OAuth error', { error });
      return res.redirect(`${config.frontendUrl}/login?error=patreon_denied`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${config.frontendUrl}/login?error=no_code`);
    }

    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;
    const userAgent = req.headers['user-agent'];

    const authResponse = await authenticateWithPatreon(code, ipAddress, userAgent);

    // Set cookies
    res.cookie('accessToken', authResponse.accessToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', authResponse.refreshToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend with success
    const redirectUrl = req.cookies?.returnUrl || '/';
    res.clearCookie('returnUrl');
    res.redirect(`${config.frontendUrl}${redirectUrl}?auth=success`);
  } catch (error) {
    logger.error('Patreon callback error', { error });
    res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
  }
});

// Email/password login
router.post('/login', async (req: AuthenticatedRequest, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;
    const userAgent = req.headers['user-agent'];

    const authResponse = await authenticateWithEmail(email, password, ipAddress, userAgent);

    // Set cookies
    res.cookie('accessToken', authResponse.accessToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', authResponse.refreshToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: authResponse,
    });
  } catch (error) {
    logger.error('Login error', { error });
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: error instanceof Error ? error.message : 'Login failed',
      },
    });
  }
});

// Refresh token
router.post('/refresh', async (req: AuthenticatedRequest, res) => {
  try {
    const { refreshToken: bodyToken } = refreshSchema.parse(req.body);
    const refreshToken = bodyToken || req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'No refresh token provided' },
      });
    }

    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;
    const userAgent = req.headers['user-agent'];

    const authResponse = await refreshTokens(refreshToken, ipAddress, userAgent);

    // Set new cookies
    res.cookie('accessToken', authResponse.accessToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', authResponse.refreshToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: authResponse,
    });
  } catch (error) {
    logger.error('Token refresh error', { error });
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired refresh token',
      },
    });
  }
});

// Logout
router.post('/logout', authenticate(false), async (req: AuthenticatedRequest, res) => {
  try {
    const token = req.cookies?.accessToken || req.headers.authorization?.slice(7);

    if (token) {
      await invalidateSession(token);
    }

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  } catch (error) {
    logger.error('Logout error', { error });
    res.json({
      success: true,
      data: { message: 'Logged out' },
    });
  }
});

// Logout all sessions
router.post('/logout-all', authenticate(), async (req: AuthenticatedRequest, res) => {
  try {
    if (req.userId) {
      await invalidateAllUserSessions(req.userId);
    }

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      data: { message: 'Logged out of all sessions' },
    });
  } catch (error) {
    logger.error('Logout all error', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to logout all sessions' },
    });
  }
});

// Get current user
router.get('/me', authenticate(), (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    data: { user: req.user },
  });
});

export default router;
