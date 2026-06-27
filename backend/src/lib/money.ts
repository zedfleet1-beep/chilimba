/**
 * Money helpers. Chilimba stores all monetary values as BigInt ngwe
 * (1/100 of a Zambian Kwacha). K1,020.00 = 102000n.
 *
 * Hard rule (see docs/design-docs/data-model.md, AGENTS.md §5):
 *   Never use Float/Double/Number for monetary arithmetic.
 *   These helpers only FORMAT for display, or PARSE validated input.
 */
import { ValidationError } from './errors';

export const NGWE_PER_KWACHA = 100n;
const KWACHA_DECIMALS = 2;

/**
 * Format a BigInt ngwe amount for human display.
 *   formatNgwe(102000n)   === 'K1,020.00'
 *   formatNgwe(0n)        === 'K0.00'
 *   formatNgwe(12345n)    === 'K123.45'
 * Also accepts number/string for display only.
 */
export function formatNgwe(amount: bigint | number | string): string {
  const big = typeof amount === 'bigint' ? amount : BigInt(amount);
  const sign = big < 0n ? '-' : '';
  const abs = big < 0n ? -big : big;
  const whole = abs / NGWE_PER_KWACHA;
  const fraction = abs % NGWE_PER_KWACHA;
  const fractionStr = fraction.toString().padStart(KWACHA_DECIMALS, '0');
  return `${sign}K${formatThousands(whole.toString())}.${fractionStr}`;
}

/**
 * Parse a "K1,020.00" / "1020.00" / "1020" string into BigInt ngwe.
 * Throws on invalid input. Strips currency prefix, commas, and whitespace.
 */
export function parseNgwe(input: string): bigint {
  if (typeof input !== 'string') {
    throw new ValidationError('Amount must be a string');
  }
  const cleaned = input.trim().replace(/^[Kk]/, '').replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new ValidationError(`Invalid money amount: "${input}"`);
  }
  const [whole, fraction = ''] = cleaned.split('.');
  const wholeBig = BigInt(whole);
  const fractionPadded = (fraction + '00').slice(0, KWACHA_DECIMALS);
  const fractionBig = BigInt(fractionPadded || '0');
  return wholeBig * NGWE_PER_KWACHA + fractionBig;
}

/**
 * Convert BigInt ngwe to a plain Number of Kwacha for display-only purposes
 * (e.g. chart axes). NEVER use the result for arithmetic — round-trip through
 * BigInt if you need to compute.
 */
export function ngweToKwacha(amount: bigint): number {
  return Number(amount) / Number(NGWE_PER_KWACHA);
}

function formatThousands(intStr: string): string {
  // Insert commas every 3 digits from the right.
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
