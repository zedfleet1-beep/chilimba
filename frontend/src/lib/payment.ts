/**
 * Pure helpers for payment-settings rendering. Mirror of the backend
 * enums in `prisma/schema.prisma` and the response shape from
 * `backend/src/modules/payment-settings/payment-settings.service.ts`.
 */
import { Building2, Smartphone } from 'lucide-vue-next';

export type PaymentMethod = 'mobile_money' | 'bank';
export type MobileMoneyProvider = 'mtn' | 'airtel' | 'zamtel';
export type Provider = MobileMoneyProvider | 'bank';

export interface PaymentDetails {
  paymentMethod: PaymentMethod;
  mobileMoneyProvider: MobileMoneyProvider | null;
  bankName: string | null;
  accountName: string;
  accountNumber: string;
  reference: string | null;
  isOverride: boolean;
}

export interface PaymentDisplay {
  badgeText: string; // e.g. "MTN Mobile Money"
  badgeClass: string; // tailwind classes for the badge
  accountLine: string; // e.g. "Chilimba Enterprises" + number on next line
  icon: typeof Smartphone | typeof Building2;
}

const PROVIDER_BADGE: Record<MobileMoneyProvider, { text: string; class: string }> = {
  mtn: { text: 'MTN Mobile Money', class: 'bg-yellow-100 text-yellow-800' },
  airtel: { text: 'Airtel Money', class: 'bg-red-100 text-red-700' },
  zamtel: { text: 'Zamtel Money', class: 'bg-emerald-100 text-emerald-800' },
};

const BANK_BADGE = { text: 'Bank transfer', class: 'bg-slate-100 text-slate-700' };

export function displayFor(p: PaymentDetails): PaymentDisplay {
  if (p.paymentMethod === 'bank') {
    return {
      badgeText: p.bankName ? `${BANK_BADGE.text} · ${p.bankName}` : BANK_BADGE.text,
      badgeClass: BANK_BADGE.class,
      accountLine: p.accountName,
      icon: Building2,
    };
  }
  const provider = p.mobileMoneyProvider ?? 'mtn';
  const badge = PROVIDER_BADGE[provider];
  return {
    badgeText: badge.text,
    badgeClass: badge.class,
    accountLine: p.accountName,
    icon: Smartphone,
  };
}
