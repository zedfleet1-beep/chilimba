/**
 * Money helpers (frontend twin of backend/src/lib/money.ts).
 * BigInt ngwe → "K1,020.00" and back.
 *
 * Hard rule (see AGENTS.md §5, backend/src/lib/money.ts): never use
 * Float for monetary arithmetic. These helpers are FORMAT/PARSE only.
 */
const NGWE_PER_KWACHA = 100n;
const KWACHA_DECIMALS = 2;

export type NgweInput = bigint | number | string;

/**
 * Format a BigInt ngwe amount for human display.
 *   formatNgwe(102000n)   === 'K1,020.00'
 *   formatNgwe(0n)        === 'K0.00'
 */
export function formatNgwe(amount: NgweInput): string {
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
 * Returns null on invalid input (UI-friendly).
 */
export function parseNgwe(input: string): bigint | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().replace(/^[Kk]/, '').replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.');
  const wholeBig = BigInt(whole);
  const fractionPadded = (fraction + '00').slice(0, KWACHA_DECIMALS);
  const fractionBig = BigInt(fractionPadded || '0');
  return wholeBig * NGWE_PER_KWACHA + fractionBig;
}

function formatThousands(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
