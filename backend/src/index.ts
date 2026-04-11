import { createApp, } from './app';
import { config, } from './config';
import { closePool, pool, } from './db';
import { cache, } from './services/cache';
import { cronRegistry, } from './services/cron';
import { verifyEmailConfig, } from './services/email';
import { initScheduledPublisher, } from './services/scheduledPublisher';
import { initSocialCrons, } from './services/socialCrons';
import { logger, } from './utils/logger';

async function main() {
    try {
        // Verify database connection
        logger.info('Connecting to database...',);
        await pool.connect();
        logger.info('Database connected',);

        // Verify Redis connection
        logger.info('Connecting to Redis...',);
        const redisHealthy = await cache.healthCheck();
        if (redisHealthy) {
            logger.info('Redis connected',);
        } else {
            logger.warn('Redis connection failed - caching will be disabled',);
        }

        // Verify email configuration
        const emailConfigured = await verifyEmailConfig();
        if (!emailConfigured) {
            logger.warn('Email configuration not set or invalid - emails will not be sent',);
        }

        // Create and start Express app
        const app = createApp();

        // Register cron jobs for connected social providers, then start all
        await initSocialCrons();
        initScheduledPublisher();
        cronRegistry.startAll();
        logger.info('Cron jobs started',);

        const server = app.listen(config.port, () => {
            logger.info(`Server running on port ${config.port}`,);
            logger.info(`Environment: ${config.env}`,);
            logger.info(`API URL: http://localhost:${config.port}/api/${config.apiVersion}`,);
        },);

        // Track open HTTP connections so we can force-close them on shutdown.
        // server.close() alone waits for keep-alive sockets to drain, which
        // can hang indefinitely in dev (browser tabs keep sockets open).
        const openSockets = new Set<import('net').Socket>();
        server.on('connection', (socket,) => {
            openSockets.add(socket,);
            socket.on('close', () => openSockets.delete(socket,),);
        },);

        // Graceful shutdown with hard timeout. A second signal forces immediate
        // exit (useful when the dev loop gets stuck on a long-running request
        // or an external service that's not responding).
        let shuttingDown = false;
        const FORCE_EXIT_MS = 3000;

        const shutdown = async (signal: string,) => {
            if (shuttingDown) {
                logger.warn(`Received ${signal} during shutdown — forcing exit`,);
                process.exit(1,);
            }
            shuttingDown = true;
            logger.info(`Received ${signal}, shutting down...`,);

            // Hard deadline so tsx watch doesn't have to force-kill us.
            const forceExitTimer = setTimeout(() => {
                logger.error(`Shutdown took longer than ${FORCE_EXIT_MS}ms — forcing exit`,);
                process.exit(1,);
            }, FORCE_EXIT_MS,);
            forceExitTimer.unref();

            try {
                // 1. Stop accepting new connections and drop existing keep-alive sockets.
                //    `server.closeAllConnections()` exists on Node 18.2+ but we
                //    also manually destroy tracked sockets as a belt-and-braces fallback.
                server.close();
                if (typeof (server as any).closeAllConnections === 'function') {
                    (server as any).closeAllConnections();
                }
                for (const socket of openSockets) {
                    socket.destroy();
                }
                openSockets.clear();

                // 2. Stop cron jobs (synchronous).
                cronRegistry.stopAll();

                // 3. Close DB + Redis in parallel — both have their own short timeouts.
                await Promise.allSettled([
                    closePool(),
                    cache.close(),
                ],);

                logger.info('Shutdown complete',);
                clearTimeout(forceExitTimer,);
                process.exit(0,);
            } catch (error) {
                logger.error('Error during shutdown', { error, },);
                clearTimeout(forceExitTimer,);
                process.exit(1,);
            }
        };

        process.on('SIGTERM', () => shutdown('SIGTERM',),);
        process.on('SIGINT', () => shutdown('SIGINT',),);
        process.on('SIGHUP', () => shutdown('SIGHUP',),);

        // Handle uncaught exceptions — exit hard, don't try to gracefully drain.
        process.on('uncaughtException', (error,) => {
            logger.error('Uncaught exception', { error, },);
            process.exit(1,);
        },);

        process.on('unhandledRejection', (reason,) => {
            logger.error('Unhandled rejection', { reason, },);
        },);
    } catch (error) {
        logger.error('Failed to start server', { error, },);
        process.exit(1,);
    }
}

main();
