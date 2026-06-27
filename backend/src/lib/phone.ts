/**
 * Phone number normalization. E.164 only.
 * Default region ZM (+260) per plan §7.1.
 */
import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';
import { ValidationError } from './errors';

const DEFAULT_REGION: CountryCode = 'ZM';

export function normalizePhone(input: string, defaultRegion: CountryCode = DEFAULT_REGION): string {
  if (!input || typeof input !== 'string') {
    throw new ValidationError('Phone number is required');
  }
  const trimmed = input.trim().replace(/\s+/g, '');
  const parsed = parsePhoneNumberFromString(trimmed, defaultRegion);
  if (!parsed || !parsed.isValid()) {
    throw new ValidationError('Enter a valid phone number with country code');
  }
  return parsed.number; // E.164: "+260977123456"
}

export function isValidPhone(input: string, defaultRegion: CountryCode = DEFAULT_REGION): boolean {
  if (!input) return false;
  const parsed = parsePhoneNumberFromString(input.trim(), defaultRegion);
  return !!parsed && parsed.isValid();
}
