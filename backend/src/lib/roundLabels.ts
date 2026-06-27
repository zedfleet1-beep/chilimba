import { ContributionFrequency } from '@prisma/client';

const PERIOD_LABEL: Record<ContributionFrequency, string> = {
  weekly: 'Week',
  fortnightly: 'Fortnight',
  monthly: 'Month',
};

export function periodLabel(frequency: ContributionFrequency): string {
  return PERIOD_LABEL[frequency] ?? 'Round';
}

export function formatRoundLabel(
  roundNumber: number,
  dueDate: Date | string,
  frequency: ContributionFrequency = 'monthly',
): string {
  const d = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const monthYear = d.toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  return `${periodLabel(frequency)} ${roundNumber} (${monthYear})`;
}