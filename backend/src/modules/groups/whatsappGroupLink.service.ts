/**
 * Link a Chilimba group to a WhatsApp group chat via OTP verification.
 *
 * Flow:
 *   1. Owner adds the Chilimba WhatsApp number to their group.
 *   2. Owner picks the group from a list (groups our Evolution instance joined).
 *   3. We post a 6-digit code in that WhatsApp group.
 *   4. Owner enters the code in settings — only then is whatsappGroupJid saved.
 */
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { fetchWhatsAppGroups, fetchEvolutionDisplayPhone, sendWhatsAppText } from '@/lib/evolution';
import { normalizeWhatsAppGroupJid } from '@/lib/groupWhatsApp';
import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

async function assertOwner(groupId: string, userId: string) {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!membership || membership.status !== 'active') {
    throw new ForbiddenError('You are not a member of this group');
  }
  if (membership.role !== 'owner') {
    throw new ForbiddenError('Only the group owner can manage WhatsApp group linking');
  }
}

export async function getWhatsappLinkInfo(groupId: string, userId: string) {
  await assertOwner(groupId, userId);
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { settings: true },
  });
  if (!group) throw new NotFoundError('Group');

  let pending: {
    whatsappJid: string;
    whatsappSubject: string | null;
    expiresAt: Date;
  } | null = null;
  try {
    pending = await prisma.whatsappGroupLinkChallenge.findFirst({
      where: { groupId, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { whatsappJid: true, whatsappSubject: true, expiresAt: true },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('whatsappGroupLinkChallenge') || msg.includes('does not exist')) {
      throw new ConflictError(
        'WHATSAPP_LINK_NOT_READY' as never,
        'WhatsApp linking is not ready on the server. Restart the backend after running database migrations.',
      );
    }
    throw e;
  }

  let botPhone: string | null = null;
  try {
    botPhone = await fetchEvolutionDisplayPhone();
  } catch {
    botPhone = null;
  }

  return {
    botPhone,
    linked: group.settings?.whatsappGroupJid
      ? { jid: group.settings.whatsappGroupJid }
      : null,
    pending: pending
      ? {
          jid: pending.whatsappJid,
          subject: pending.whatsappSubject,
          expiresAt: pending.expiresAt.toISOString(),
        }
      : null,
  };
}

export async function listLinkableWhatsappGroups(groupId: string, userId: string) {
  await assertOwner(groupId, userId);
  const { groups, error } = await fetchWhatsAppGroups();
  if (groups.length === 0 && error) {
    throw new ConflictError('WHATSAPP_GROUPS_UNAVAILABLE' as never, error);
  }
  return { groups };
}

export async function sendWhatsappGroupVerification(
  groupId: string,
  userId: string,
  input: { jid: string; subject?: string },
) {
  await assertOwner(groupId, userId);
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { name: true },
  });
  if (!group) throw new NotFoundError('Group');

  let jid: string;
  try {
    jid = normalizeWhatsAppGroupJid(input.jid);
  } catch (e) {
    throw new ConflictError('INVALID_JID' as never, (e as Error).message);
  }

  const { groups } = await fetchWhatsAppGroups();
  const match = groups.find((g) => g.jid === jid);
  if (!match) {
    throw new ConflictError(
      'GROUP_NOT_FOUND' as never,
      'This WhatsApp group was not found. Add the Chilimba number to the group, wait a minute, then refresh the list.',
    );
  }

  const taken = await prisma.groupSetting.findFirst({
    where: { whatsappGroupJid: jid, NOT: { groupId } },
    select: { groupId: true },
  });
  if (taken) {
    throw new ConflictError(
      'JID_ALREADY_LINKED' as never,
      'This WhatsApp group is already linked to another Chilimba group',
    );
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  const subject = input.subject ?? match.name;

  await prisma.whatsappGroupLinkChallenge.updateMany({
    where: { groupId, used: false },
    data: { used: true },
  });

  await prisma.whatsappGroupLinkChallenge.create({
    data: {
      groupId,
      whatsappJid: jid,
      whatsappSubject: subject,
      code,
      expiresAt,
      createdById: userId,
    },
  });

  const message = [
    `*Chilimba verification*`,
    ``,
    `Linking WhatsApp group to *${group.name}*.`,
    ``,
    `Your verification code is: *${code}*`,
    ``,
    `Enter this code in Chilimba → Group settings → WhatsApp group.`,
    `Expires in 10 minutes.`,
    ``,
    `If you did not request this, ignore this message.`,
  ].join('\n');

  const sent = await sendWhatsAppText(jid, message);
  if (!sent.ok && process.env.NODE_ENV !== 'test') {
    throw new ConflictError(
      'WHATSAPP_SEND_FAILED' as never,
      sent.error ?? 'Could not send verification code to the WhatsApp group',
    );
  }

  return {
    jid,
    subject,
    expiresAt: expiresAt.toISOString(),
    message: 'Verification code sent to the WhatsApp group. Check the group chat and enter the code below.',
  };
}

export async function verifyWhatsappGroupLink(
  groupId: string,
  userId: string,
  code: string,
) {
  await assertOwner(groupId, userId);

  const challenge = await prisma.whatsappGroupLinkChallenge.findFirst({
    where: { groupId, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!challenge) {
    throw new ConflictError(
      'NO_PENDING_CHALLENGE' as never,
      'No pending verification. Select your group and send a new code.',
    );
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    throw new ConflictError(
      'TOO_MANY_ATTEMPTS' as never,
      'Too many failed attempts. Send a new verification code.',
    );
  }

  if (challenge.code !== code) {
    await prisma.whatsappGroupLinkChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    throw new ConflictError('INVALID_CODE' as never, 'Incorrect code. Check the WhatsApp group message and try again.');
  }

  const taken = await prisma.groupSetting.findFirst({
    where: { whatsappGroupJid: challenge.whatsappJid, NOT: { groupId } },
  });
  if (taken) {
    throw new ConflictError(
      'JID_ALREADY_LINKED' as never,
      'This WhatsApp group was linked to another Chilimba group while you were verifying',
    );
  }

  await prisma.$transaction([
    prisma.whatsappGroupLinkChallenge.update({
      where: { id: challenge.id },
      data: { used: true },
    }),
    prisma.groupSetting.update({
      where: { groupId },
      data: { whatsappGroupJid: challenge.whatsappJid },
    }),
  ]);

  return {
    linked: {
      jid: challenge.whatsappJid,
      subject: challenge.whatsappSubject,
    },
  };
}

export async function unlinkWhatsappGroup(groupId: string, userId: string) {
  await assertOwner(groupId, userId);
  await prisma.groupSetting.update({
    where: { groupId },
    data: { whatsappGroupJid: null },
  });
  await prisma.whatsappGroupLinkChallenge.updateMany({
    where: { groupId, used: false },
    data: { used: true },
  });
  return { ok: true as const };
}