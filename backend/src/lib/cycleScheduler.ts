/**
 * Pure helpers for cycle round generation, due-date math, and recipient
 * assignment. No DB, no req/res — easy to unit-test and to reuse from
 * seed scripts.
 */
import { ContributionFrequency, PayoutMethod, GroupMember } from '@prisma/client';

const FREQUENCY_DAYS: Record<ContributionFrequency, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
};

export interface GeneratedRound {
  roundNumber: number;
  dueDate: Date;
  /** Member ids that will receive the payout for this round, in order. */
  recipientMemberIds: string[];
}

export interface GenerateRoundsInput {
  /** Active members of the group, in payout-position order. */
  members: Pick<GroupMember, 'id' | 'payoutPosition'>[];
  /** Settings.payoutRecipientsCount. */
  payoutRecipientsCount: number;
  /** Settings.contributionFrequency. */
  frequency: ContributionFrequency;
  /** The date the cycle started (rounds anchor to this). */
  startDate: Date;
  /** The payout method — controls recipient assignment. */
  payoutMethod: PayoutMethod;
  /** Member ids that have already received a payout in earlier rounds
   *  (used for `random` to avoid double-picking). Pass [] for a fresh
   *  cycle; the service updates this across rounds as it generates. */
  previouslyAssignedMemberIds: string[];
}

export function roundsCount(memberCount: number, payoutRecipientsCount: number): number {
  if (memberCount <= 0 || payoutRecipientsCount <= 0) return 0;
  return Math.ceil(memberCount / payoutRecipientsCount);
}

export function dueDateForRound(
  startDate: Date,
  frequency: ContributionFrequency,
  roundIndexZeroBased: number,
): Date {
  const days = FREQUENCY_DAYS[frequency] * roundIndexZeroBased;
  return new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Generate the full list of rounds for a new cycle, with recipients
 * pre-assigned per `payoutMethod`.
 *
 *   - `queue`:    deterministic by `payoutPosition` order.
 *                 round 1 → members at positions 1..N
 *                 round 2 → members at positions N+1..2N
 *                 round 3 → members at positions 2N+1..3N
 *                 (wraps if there are more rounds than members × recipients)
 *   - `random`:   random draw from members who haven't already been
 *                 assigned a payout this cycle (passed in via
 *                 `previouslyAssignedMemberIds`).
 *   - `manual`/`voting`: recipients are assigned later by the owner. We
 *                 still return the round rows with `recipientMemberIds: []`
 *                 so the round is created up-front.
 */
export function generateRounds(input: GenerateRoundsInput): GeneratedRound[] {
  const {
    members,
    payoutRecipientsCount,
    frequency,
    startDate,
    payoutMethod,
    previouslyAssignedMemberIds,
  } = input;

  // Filter to active, paid members in payout-position order.
  const ordered = [...members]
    .filter((m) => m.payoutPosition !== null)
    .sort((a, b) => (a.payoutPosition ?? 0) - (b.payoutPosition ?? 0));

  const count = roundsCount(ordered.length, payoutRecipientsCount);
  const rounds: GeneratedRound[] = [];
  const alreadyAssigned = new Set(previouslyAssignedMemberIds);

  for (let i = 0; i < count; i++) {
    const recipients = pickRecipients({
      ordered,
      payoutRecipientsCount,
      payoutMethod,
      roundIndexZeroBased: i,
      alreadyAssigned,
    });
    rounds.push({
      roundNumber: i + 1,
      dueDate: dueDateForRound(startDate, frequency, i),
      recipientMemberIds: recipients,
    });
    recipients.forEach((id) => alreadyAssigned.add(id));
  }

  return rounds;
}

function pickRecipients(params: {
  ordered: Pick<GroupMember, 'id' | 'payoutPosition'>[];
  payoutRecipientsCount: number;
  payoutMethod: PayoutMethod;
  roundIndexZeroBased: number;
  alreadyAssigned: Set<string>;
}): string[] {
  const { ordered, payoutRecipientsCount, payoutMethod, roundIndexZeroBased, alreadyAssigned } = params;

  if (ordered.length === 0 || payoutRecipientsCount <= 0) return [];

  switch (payoutMethod) {
    case PayoutMethod.queue: {
      // Deterministic by position. Wraps around the member list so a group
      // with 5 members and 2 recipients/round still has 3 rounds and each
      // member receives at least one payout before anyone gets a second.
      const out: string[] = [];
      for (let i = 0; i < payoutRecipientsCount; i++) {
        const idx = (roundIndexZeroBased * payoutRecipientsCount + i) % ordered.length;
        out.push(ordered[idx].id);
      }
      return out;
    }
    case PayoutMethod.random: {
      // Random draw from members not yet assigned this cycle. Falls back to
      // ordered if the pool is exhausted (degenerate case).
      const pool = ordered.filter((m) => !alreadyAssigned.has(m.id));
      const source = pool.length >= payoutRecipientsCount ? pool : ordered;
      return drawN(source.map((m) => m.id), payoutRecipientsCount);
    }
    case PayoutMethod.manual:
    case PayoutMethod.voting:
    default:
      // Manual / voting: recipients are assigned later.
      return [];
  }
}

/**
 * Randomly pick N distinct elements from `source`. Pure (uses a seeded
 * shuffle). For non-test usage the caller should not pass a seed and
 * the result will be a real random draw.
 */
function drawN<T>(source: T[], n: number, seed?: number): T[] {
  if (n <= 0) return [];
  if (n >= source.length) return [...source];
  const arr = [...source];
  let s = seed ?? Date.now();
  // Fisher–Yates with a small LCG for determinism when `seed` is given.
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}
