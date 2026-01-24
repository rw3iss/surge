import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../db';
import type { User, UserRole } from '@surge/shared';

export interface AuthenticatedRequest extends Request {
  user?: User;
  userId?: string;
}

interface JwtPayload {
  userId: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export function authenticate(required = true) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : req.cookies?.accessToken;

      if (!token) {
        if (required) {
          return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          });
        }
        return next();
      }

      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

      const result = await query<User>(
        `SELECT id, email, display_name, avatar_url, role, auth_provider,
                patreon_id, patreon_tier, is_active, is_banned,
                last_login_at, created_at, updated_at
         FROM users WHERE id = $1`,
        [decoded.userId]
      );

      const user = result.rows[0];

      if (!user) {
        if (required) {
          return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'User not found' },
          });
        }
        return next();
      }

      if (!user.is_active || user.is_banned) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Account is disabled or banned' },
        });
      }

      // Convert snake_case to camelCase
      req.user = {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        role: user.role,
        authProvider: user.auth_provider,
        patreonId: user.patreon_id,
        patreonTier: user.patreon_tier,
        isActive: user.is_active,
        isBanned: user.is_banned,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      } as User;
      req.userId = user.id;

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Token expired' },
        });
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
        });
      }

      if (required) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication failed' },
        });
      }

      next();
    }
  };
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
    }

    next();
  };
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return requireRole('admin')(req, res, next);
}
