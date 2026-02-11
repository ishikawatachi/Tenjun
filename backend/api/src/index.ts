import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import config from './config/config';
import { initDatabase, closeDatabase } from './database/db';
import { requestLogger, logger } from './middleware/logging.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';

// Import routes
import authRoutes from './routes/auth.routes';
import threatModelsRoutes from './routes/threatModels.routes';
import analysisRoutes from './routes/analysis.routes';
import webhookRoutes from './routes/webhook.routes';
import jiraRoutes from '../../routes/jira.routes';

/**
 * Initialize Express application
 */
const app: Application = express();

/**
 * Swagger/OpenAPI configuration
 */
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Threat Modeling Platform API',
      version: '1.0.0',
      description: 'API for managing threat models and security analysis',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Security middleware
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

/**
 * CORS configuration
 */
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

/**
 * Rate limiting
 */
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

/**
 * Body parsing middleware
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Request logging
 */
app.use(requestLogger);

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    version: '1.0.0',
  });
});

/**
 * API Documentation
 */
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Threat Modeling API Docs',
}));

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/threat-models', threatModelsRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/jira', jiraRoutes);

/**
 * Root endpoint
 */
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Threat Modeling Platform API',
    version: '1.0.0',
    documentation: '/api-docs',
    health: '/health',
  });
});

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.path,
  });
});

/**
 * Global error handler
 */
app.use(errorHandler);

/**
 * Initialize database and start server
 */
const startServer = async (): Promise<void> => {
  try {
    // Initialize database
    initDatabase();
    logger.info('Database initialized successfully');

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`, {
        environment: config.nodeEnv,
        port: config.port,
      });
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Threat Modeling Platform API                           ║
║   Environment: ${config.nodeEnv.padEnd(43)}║
║   Port: ${config.port.toString().padEnd(50)}║
║                                                           ║
║   API Documentation: http://localhost:${config.port}/api-docs     ║
║   Health Check: http://localhost:${config.port}/health            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received, shutting down gracefully`);
      
      server.close(() => {
        logger.info('HTTP server closed');
        closeDatabase();
        logger.info('Database connection closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Unhandled rejection handler
    process.on('unhandledRejection', (reason: Error) => {
      logger.error('Unhandled Rejection', { error: reason.message, stack: reason.stack });
      throw reason;
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
      closeDatabase();
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;
