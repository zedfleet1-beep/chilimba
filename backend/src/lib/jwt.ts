/**
 * JWT helpers. Access (15m), refresh (30d), and a short-lived group-creation
 * token (48h) used to unlock the customer-facing `/groups` POST.
 *
 * Each kind has its own secret. Mixing them is a bug — the verify functions
 * reject tokens signed with a different secret.
 */
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '@/env';

export type Role = 'super_admin' | 'owner' | 'treasurer' | 'member';

export interface AccessTokenPayload {
  sub: string;            // user id
  role: Role;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;            // unique id (for revocation list)
}

/**
 * Group-creation token. The `phone` field is the binding identifier (NOT
 * userId), because the customer may not have signed up when the admin
 * approves the POP. The service upserts a `User` row by phone at create time.
 */
export interface GroupCreationTokenPayload {
  invoiceId: string;
  phone: string;
  purpose: 'group_creation';
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const opts: SignOptions = { expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, opts);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  const opts: SignOptions = { expiresIn: env.JWT_REFRESH_TTL as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, opts);
}

export function signGroupCreationToken(payload: Omit<GroupCreationTokenPayload, 'purpose'>): string {
  const opts: SignOptions = { expiresIn: '48h' };
  return jwt.sign({ ...payload, purpose: 'group_creation' }, env.JWT_GROUP_TOKEN_SECRET, opts);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

export function verifyGroupCreationToken(token: string): GroupCreationTokenPayload {
  const payload = jwt.verify(token, env.JWT_GROUP_TOKEN_SECRET) as GroupCreationTokenPayload;
  if (payload.purpose !== 'group_creation') {
    throw new Error('Token is not a group-creation token');
  }
  return payload;
}

