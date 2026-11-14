import { Request, Response, NextFunction } from 'express';

/**
 * Rate limiting disabled.
 * Pass-through middleware and stub functions preserved for backward compatibility.
 */
export function globalRateLimiter() {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    next();
  };
}

export async function consumeAuthRateLimit(_key: string): Promise<void> {
  // Rate limiting disabled
}

export async function consumeMutationRateLimit(_key: string): Promise<void> {
  // Rate limiting disabled
}

