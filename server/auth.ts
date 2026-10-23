import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'pc_session';

/**
 * The session token is derived from the secret, so there is nothing to store
 * server-side, and changing APP_PASSWORD (or SESSION_SECRET) logs everyone out.
 */
export function sessionToken(secret: string): string {
  return createHmac('sha256', secret).update('promptcentral-session-v1').digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** A small in-memory brake on password guessing; a 4-digit PIN is otherwise trivial to brute-force. */
export class LoginLimiter {
  private failures = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly maxFailures = 10,
    private readonly windowMs = 15 * 60 * 1000,
  ) {}

  isBlocked(key: string, now = Date.now()): boolean {
    const entry = this.failures.get(key);
    if (!entry) return false;
    if (entry.resetAt <= now) {
      this.failures.delete(key);
      return false;
    }
    return entry.count >= this.maxFailures;
  }

  recordFailure(key: string, now = Date.now()): void {
    const entry = this.failures.get(key);
    if (!entry || entry.resetAt <= now) {
      this.failures.set(key, { count: 1, resetAt: now + this.windowMs });
    } else {
      entry.count++;
    }
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}
