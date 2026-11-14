import 'reflect-metadata';
import {
  generateTokens,
  verifyToken,
  extractTokenFromHeader,
} from '../middleware/auth';
import { User, UserRole } from '../models/User';

describe('Auth Middleware & Token Unit Tests', () => {
  const dummyUser = new User();
  dummyUser.id = 'b4578119-94d3-4fc6-b7cf-54734ef52174';
  dummyUser.email = 'test@example.com';
  dummyUser.role = UserRole.MEMBER;

  it('should generate valid access and refresh tokens', () => {
    const tokens = generateTokens(dummyUser);
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();

    const decoded = verifyToken(tokens.accessToken);
    expect(decoded.userId).toBe(dummyUser.id);
    expect(decoded.email).toBe(dummyUser.email);
    expect(decoded.role).toBe(UserRole.MEMBER);
  });

  it('should extract Bearer token from Authorization header properly', () => {
    expect(extractTokenFromHeader('Bearer my-secret-token')).toBe('my-secret-token');
    expect(extractTokenFromHeader('Basic xyz')).toBeNull();
    expect(extractTokenFromHeader('')).toBeNull();
    expect(extractTokenFromHeader(undefined)).toBeNull();
  });

  it('should throw when verifying invalid tokens', () => {
    expect(() => verifyToken('invalid.token.structure')).toThrow();
  });
});
