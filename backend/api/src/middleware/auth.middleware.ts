import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/config';
import { AuthenticationError } from '../utils/errors';
import { auditLogger } from './logging.middleware';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * Middleware to validate JWT tokens using RS256 algorithm
 */
export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7);

    if (!config.jwt.publicKey) {
      throw new Error('JWT public key not configured');
    }

    // Verify token with RS256 algorithm
    const decoded = jwt.verify(token, config.jwt.publicKey, {
      algorithms: [config.jwt.algorithm],
    }) as JwtPayload;

    // Attach user information to request
    req.user = decoded;

    // Audit log the authenticated request
    auditLogger.info('Authenticated request', {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthenticationError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AuthenticationError('Token expired'));
    } else {
      next(error);
    }
  }
};

/**
 * Middleware to check for specific roles
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('User not authenticated'));
    }

    if (!roles.includes(req.user.role)) {
      auditLogger.warn('Authorization failed', {
        userId: req.user.userId,
        requiredRoles: roles,
        actualRole: req.user.role,
        path: req.path,
      });
      return next(new AuthenticationError('Insufficient permissions'));
    }

    next();
  };
};

/**
 * Generate JWT token for a user
 */
export const generateToken = (payload: JwtPayload): string => {
  if (!config.jwt.privateKey) {
    throw new Error('JWT private key not configured');
  }

  return jwt.sign(payload, config.jwt.privateKey, {
    algorithm: config.jwt.algorithm,
    expiresIn: config.jwt.expiresIn, // 1 hour
  });
};
