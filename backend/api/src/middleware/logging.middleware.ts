import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import config from '../config/config';

// Ensure logs directory exists
const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Winston logger configuration
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Application logger
export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    new winston.transports.File({ 
      filename: config.logging.file,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5,
    }),
  ],
});

// Add console logging in development
if (config.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

// Audit logger for security events
export const auditLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'audit.log'),
      maxsize: 10485760,
      maxFiles: 10,
    }),
  ],
});

/**
 * Request logging middleware
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    logger.log(logLevel, 'Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });

    // Audit log for sensitive operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      auditLogger.info('Data modification', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });
    }
  });

  next();
};
