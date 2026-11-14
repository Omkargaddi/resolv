import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../models/User';

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

export function generateTokens(user: User): {
  accessToken: string;
  refreshToken: string;
} {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: 'reserve-api',
    audience: 'reserve-client',
  });

  const refreshToken = jwt.sign(
    { userId: user.id, tokenType: 'refresh' },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'], issuer: 'reserve-api' }
  );

  return { accessToken, refreshToken };
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET, {
    issuer: 'reserve-api',
    audience: 'reserve-client',
  }) as AuthPayload;
}

export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractTokenFromHeader(req.headers.authorization);

  if (!token) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug('Token expired', { error: error.message });
      res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
      return;
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid token presented', { error: error.message });
    }

    res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
    });
  }
}

export function authorizeRole(...roles: UserRole[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Insufficient permissions. Required: ${roles.join(' or ')}`,
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET, {
      issuer: 'reserve-api',
    }) as { userId: string; tokenType: string };

    if (decoded.tokenType !== 'refresh') {
      return null;
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: decoded.userId, isActive: true },
    });

    if (!user || user.refreshToken !== refreshToken) {
      logger.warn('Refresh token reuse detected or user not found', {
        userId: decoded.userId,
      });
      return null;
    }

    // Rotate refresh token
    const tokens = generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await userRepo.save(user);

    return tokens;
  } catch {
    return null;
  }
}
