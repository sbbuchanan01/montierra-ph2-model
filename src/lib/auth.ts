import { createHmac, timingSafeEqual } from 'crypto';

export const AUTH_COOKIE = 'montierra_auth';

function expectedSignature(exp: string, secret: string): string {
  return createHmac('sha256', secret).update(`montierra:${exp}`).digest('hex');
}

export function verifyToken(token: string | undefined, secret: string): boolean {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = expectedSignature(exp, secret);
  if (expected.length !== sig.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
  } catch {
    return false;
  }
}

export function makeToken(secret: string, ttlMs = 30 * 24 * 3600 * 1000): string {
  const exp = String(Date.now() + ttlMs);
  return `${exp}.${expectedSignature(exp, secret)}`;
}
