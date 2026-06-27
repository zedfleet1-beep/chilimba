export type ContributionFrequency = 'weekly' | 'fortnightly' | 'monthly';

const PERIOD_LABEL: Record<ContributionFrequency, string> = {
  weekly: 'Week',
  fortnightly: 'Fortnight',
  monthly: 'Month',
};

export function periodLabel(frequency: ContributionFrequency = 'monthly'): string {
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

export function cycleProgress(currentRound: number, totalRounds: number, frequency: ContributionFrequency = 'monthly') {
  const label = periodLabel(frequency);
  return {
    current: currentRound,
    total: totalRounds,
    label: `${label} ${currentRound} of ${totalRounds}`,
    percent: totalRounds > 0 ? Math.round((currentRound / totalRounds) * 100) : 0,
  };
}