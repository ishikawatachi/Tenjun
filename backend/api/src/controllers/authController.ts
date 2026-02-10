import { Response } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { AuthenticatedRequest, generateToken } from '../middleware/auth.middleware';
import { executeQuerySingle, executeWrite, createAuditLog } from '../database/db';
import {
  ValidationError,
  AuthenticationError,
  ConflictError,
} from '../utils/errors';
import { asyncHandler } from '../middleware/errorHandler.middleware';
import { logger } from '../middleware/logging.middleware';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum(['user', 'admin']).optional().default('user'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

interface User {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: string;
}

/**
 * Register a new user
 */
export const register = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Validate request body
    const validatedData = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = executeQuerySingle<User>(
      'SELECT id FROM users WHERE email = ?',
      [validatedData.email]
    );

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validatedData.password, 12);

    // Create user
    const userId = uuidv4();
    const now = new Date().toISOString();

    executeWrite(
      'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, validatedData.email, passwordHash, validatedData.role, now, now]
    );

    // Audit log
    createAuditLog(
      userId,
      'REGISTER',
      'user',
      userId,
      { email: validatedData.email, role: validatedData.role },
      req.ip
    );

    logger.info('User registered', { userId, email: validatedData.email });

    // Generate token
    const token = generateToken({
      userId,
      email: validatedData.email,
      role: validatedData.role,
    });

    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: userId,
          email: validatedData.email,
          role: validatedData.role,
        },
        token,
      },
    });
  }
);

/**
 * Login user
 */
export const login = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Validate request body
    const validatedData = loginSchema.parse(req.body);

    // Find user
    const user = executeQuerySingle<User>(
      'SELECT id, email, password_hash, role FROM users WHERE email = ?',
      [validatedData.email]
    );

    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      validatedData.password,
      user.password_hash
    );

    if (!isPasswordValid) {
      // Audit log failed login
      createAuditLog(
        undefined,
        'LOGIN_FAILED',
        'user',
        user.id,
        { email: validatedData.email },
        req.ip
      );

      throw new AuthenticationError('Invalid credentials');
    }

    // Audit log successful login
    createAuditLog(
      user.id,
      'LOGIN_SUCCESS',
      'user',
      user.id,
      { email: validatedData.email },
      req.ip
    );

    logger.info('User logged in', { userId: user.id, email: user.email });

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  }
);

/**
 * Get current user profile
 */
export const getProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AuthenticationError();
    }

    const user = executeQuerySingle<User>(
      'SELECT id, email, role, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    res.json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          created_at: user.created_at,
        },
      },
    });
  }
);

/**
 * Refresh token
 */
export const refreshToken = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AuthenticationError();
    }

    // Generate new token
    const token = generateToken({
      userId: req.user.userId,
      email: req.user.email,
      role: req.user.role,
    });

    logger.info('Token refreshed', { userId: req.user.userId });

    res.json({
      status: 'success',
      data: { token },
    });
  }
);
