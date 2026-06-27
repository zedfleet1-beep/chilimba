/**
 * Shared Zod schemas. Import these from your *.validators.ts to keep
 * cross-module rules (phone format, IDs) from drifting.
 */
import { z } from 'zod';

/** A phone number is always stored in E.164 form. Format check only — full
 *  validation (E.164 + valid country code) happens in lib/phone.ts. */
export const phoneSchema = z.string().min(8).max(20);

/** UUID v4 used for every primary key in the schema. */
export const idSchema = z.string().uuid();

/** Coerce a numeric or numeric-string into BigInt. Reject negatives and
 *  non-integer values. Used for ngwe amounts. */
export const bigintFromNumberish = z
  .union([z.string().regex(/^\d+$/), z.number().int().nonnegative()])
  .transform((v) => BigInt(v));
