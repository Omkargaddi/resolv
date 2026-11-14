import 'reflect-metadata';
import 'dotenv/config';

import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { initializeDatabase, closeDatabase } from './config/database';
import { QueueService } from './services/QueueService';
import { WebSocketService } from './utils/websocket';
import RedisClient from './utils/redis';
import { logger } from './utils/logger';
import apiRouter from './routes';

async function bootstrap(): Promise<void> {
  const PORT = parseInt(process.env.PORT || '4000', 10);

  const app = express();
  const httpServer = http.createServer(app);

  await initializeDatabase();
  logger.info('Database initialized');

  const wsService = WebSocketService.getInstance();
  wsService.initialize(httpServer, '/ws');

  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(compression());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  // HTTP Request Logger
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    res.on('finish', () => {
      logger.info('HTTP request', {
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Date.now() - startTime,
      });
    });
    next();
  });

  // Health check endpoint (unauthenticated, un-rate-limited)
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // ─── API Routes ───────────────────────────────────────
  app.use('/api', apiRouter);

  // 404 Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Endpoint not found',
      code: 'NOT_FOUND',
    });
  });

  // Central Error Handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled request error', { error: err.message, stack: err.stack });
    res.status(500).json({
      error: 'An unexpected error occurred',
      code: 'INTERNAL_SERVER_ERROR',
    });
  });

  // ─── Queue Workers ────────────────────────────────────
  const queueService = QueueService.getInstance();

  queueService.registerWorker('booking:confirmed', async (job) => {
    logger.info('Processing booking confirmation', { data: job.data });
    // In production: send email, update analytics, etc.
  });

  queueService.registerWorker('booking:cancelled', async (job) => {
    logger.info('Processing booking cancellation', { data: job.data });
    // In production: process refund, notify waitlist, etc.
  });

  // Schedule recurring slot reclamation (every 5 minutes)
  await queueService.scheduleRecurring(
    'slot:reclaim-expired-holds',
    {},
    '*/5 * * * *'
  );

  // ─── Start Server ────────────────────────────────────
  httpServer.listen(PORT, () => {
    logger.info(`Resolv REST running at http://localhost:${PORT}/api`);
    logger.info(`WebSockets at ws://localhost:${PORT}/ws`);
    logger.info(`Health check at http://localhost:${PORT}/health`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // ─── Graceful Shutdown ───────────────────────────────
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      httpServer.close(async () => {
        await wsService.close();
        await queueService.shutdown();
        await closeDatabase();
        await RedisClient.disconnect();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      });

      // Force exit after 30s
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    });
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to start Resolv', { error });
  process.exit(1);
});
