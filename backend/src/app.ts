import express, { Express, json, urlencoded, raw } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error';
import { logger } from './utils/logger';

export function createApp(): Express {
  const app = express();

  // Trust proxy for rate limiting and IP detection
  app.set('trust proxy', 1);

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: config.isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              scriptSrc: ["'self'"],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              connectSrc: ["'self'", 'https://api.stripe.com'],
              frameSrc: ["'self'", 'https://js.stripe.com'],
            },
          }
        : false,
    })
  );

  // CORS configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        if (config.corsOrigins.includes(origin) || !config.isProduction) {
          return callback(null, true);
        }

        logger.warn('CORS blocked request', { origin });
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Compression
  app.use(compression());

  // Cookie parser
  app.use(cookieParser());

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests, please try again later',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path.startsWith('/api/v1/health');
    },
  });

  app.use(limiter);

  // Body parsers
  // Stripe webhook needs raw body
  app.use('/api/v1/campaigns/webhook', raw({ type: 'application/json' }));
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.debug(`${req.method} ${req.path}`, {
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
      });
    });
    next();
  });

  // Static files (uploads)
  app.use('/uploads', express.static(path.join(process.cwd(), config.upload.dir)));

  // API routes
  app.use(`/api/${config.apiVersion}`, routes);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);

  return app;
}
