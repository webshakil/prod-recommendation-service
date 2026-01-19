/**
 * Recommendation Service - Main Application
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import config from './config/index.js';
import routes from './routes/index.js';
import logger from './utils/logger.js';
import db from './utils/database.js';
import { shapedClient, forceFlush } from './services/shaped/index.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({ method: req.method, url: req.url, status: res.statusCode, duration: Date.now() - start });
  });
  next();
});

// Health check
app.get('/health', async (req, res) => {
  const dbHealthy = await db.checkConnection();
  const shapedHealthy = await shapedClient.healthCheck();
  const status = dbHealthy && shapedHealthy ? 'healthy' : 'degraded';

  res.status(status === 'healthy' ? 200 : 503).json({
    status,
    service: 'recommendation-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    dependencies: { database: dbHealthy ? 'connected' : 'disconnected', shapedAI: shapedHealthy ? 'connected' : 'disconnected' },
  });
});

// API Routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found', path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error({ error: err.message, stack: err.stack, path: req.path }, 'Unhandled error');
  res.status(err.status || 500).json({ success: false, error: config.server.env === 'production' ? 'Internal server error' : err.message });
});

// Startup
const startServer = async () => {
  try {
    const dbConnected = await db.checkConnection();
    logger.info({ connected: dbConnected }, 'Database check');

    const shapedConnected = await shapedClient.healthCheck();
    logger.info({ connected: shapedConnected }, 'Shaped AI check');

    app.listen(config.server.port, () => {
      logger.info({ port: config.server.port, env: config.server.env }, 'Server started');
      console.log(`
╔═══════════════════════════════════════════════════════╗
║   🎯 VOTTERY RECOMMENDATION SERVICE                   ║
║   Port: ${config.server.port}  |  Env: ${config.server.env.padEnd(11)}              ║
║   DB: ${dbConnected ? '✓' : '✗'}  |  Shaped: ${shapedConnected ? '✓' : '✗'}                           ║
╠═══════════════════════════════════════════════════════╣
║   GET  /api/recommendations/elections                 ║
║   GET  /api/recommendations/similar/:id               ║
║   GET  /api/recommendations/trending                  ║
║   POST /api/events/vote                               ║
║   POST /api/sync/full                                 ║
╚═══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to start server');
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info({ signal }, 'Shutting down...');
  try {
    await forceFlush();
    await db.close();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error: error.message }, 'Shutdown error');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (error) => { logger.error({ error: error.message }, 'Uncaught Exception'); shutdown('uncaughtException'); });
process.on('unhandledRejection', (reason) => { logger.error({ reason }, 'Unhandled Rejection'); });

startServer();

export default app;