import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../models/User';
import {
  generateTokens,
  refreshAccessToken,
  AuthenticatedRequest,
} from '../middleware/auth';
import { consumeAuthRateLimit } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, password, phone } = req.body;

      if (!name || !email || !password) {
        res.status(400).json({
          error: 'Name, email, and password are required',
          code: 'BAD_USER_INPUT',
        });
        return;
      }

      const userRepo = AppDataSource.getRepository(User);
      const existingUser = await userRepo.findOne({
        where: { email: email.toLowerCase().trim() },
      });

      if (existingUser) {
        res.status(409).json({
          error: 'An account with this email already exists',
          code: 'CONFLICT',
        });
        return;
      }

      const user = userRepo.create({
        name,
        email: email.toLowerCase().trim(),
        password,
        phone,
        role: UserRole.MEMBER,
      });

      await userRepo.save(user);
      const tokens = generateTokens(user);

      user.refreshToken = tokens.refreshToken;
      await userRepo.save(user);

      logger.info('User registered', { userId: user.id, email: user.email });

      res.status(201).json({
        ...tokens,
        user: user.toJSON(),
      });
    } catch (error) {
      logger.error('Registration failed', { error });
      res.status(500).json({
        error: 'An unexpected error occurred during registration',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          error: 'Email and password are required',
          code: 'BAD_USER_INPUT',
        });
        return;
      }

      await consumeAuthRateLimit(`login:${email.toLowerCase().trim()}`);

      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo
        .createQueryBuilder('user')
        .addSelect('user.password')
        .where('user.email = :email', { email: email.toLowerCase().trim() })
        .andWhere('user.isActive = :isActive', { isActive: true })
        .getOne();

      if (!user) {
        res.status(401).json({
          error: 'Invalid email or password',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        res.status(401).json({
          error: 'Invalid email or password',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const tokens = generateTokens(user);

      user.refreshToken = tokens.refreshToken;
      user.lastLoginAt = new Date();
      await userRepo.save(user);

      logger.info('User logged in', { userId: user.id });

      res.json({
        ...tokens,
        user: user.toJSON(),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Too many login attempts')) {
        res.status(429).json({
          error: error.message,
          code: 'RATE_LIMIT_EXCEEDED',
        });
        return;
      }

      logger.error('Login failed', { error });
      res.status(500).json({
        error: 'An unexpected error occurred during login',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  static async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          error: 'Refresh token is required',
          code: 'BAD_USER_INPUT',
        });
        return;
      }

      const tokens = await refreshAccessToken(refreshToken);
      if (!tokens) {
        res.status(401).json({
          error: 'Invalid or expired refresh token',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      res.json(tokens);
    } catch (error) {
      logger.error('Token refresh failed', { error });
      res.status(500).json({
        error: 'An unexpected error occurred during token refresh',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  static async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userRepo = AppDataSource.getRepository(User);
      await userRepo.update(req.user!.userId, { refreshToken: undefined });

      res.json({ success: true });
    } catch (error) {
      logger.error('Logout failed', { error });
      res.status(500).json({
        error: 'An unexpected error occurred during logout',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  static async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { id: req.user!.userId },
      });

      if (!user) {
        res.status(404).json({
          error: 'User not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      res.json(user.toJSON());
    } catch (error) {
      logger.error('Failed to get current user profile', { error });
      res.status(500).json({
        error: 'An unexpected error occurred',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  static async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, phone } = req.body;
      const userRepo = AppDataSource.getRepository(User);

      await userRepo.update(req.user!.userId, {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
      });

      const updatedUser = await userRepo.findOneOrFail({
        where: { id: req.user!.userId },
      });

      res.json(updatedUser.toJSON());
    } catch (error) {
      logger.error('Failed to update profile', { error });
      res.status(500).json({
        error: 'An unexpected error occurred',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }
}

export default AuthController;
