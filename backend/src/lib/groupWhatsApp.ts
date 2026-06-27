/**
 * Send announcements to a group's linked WhatsApp group chat.
 * The JID is stored on group_settings.whatsappGroupJid (e.g. 120363...@g.us).
 */
import { prisma } from './prisma';
import { sendWhatsAppText } from './evolution';
import { logger } from './logger';
import { WhatsappLogStatus } from '@prisma/client';

export function normalizeWhatsAppGroupJid(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('WhatsApp group ID is required');
  if (trimmed.includes('@g.us')) {
    return trimmed.replace(/\s/g, '');
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10) throw new Error('Enter a valid WhatsApp group JID (e.g. 120363...@g.us)');
  return `${digits}@g.us`;
}

export async function sendGroupWhatsApp(groupId: string, message: string): Promise<boolean> {
  const settings = await prisma.groupSetting.findUnique({
    where: { groupId },
    select: { whatsappGroupJid: true },
  });
  if (!settings?.whatsappGroupJid) return false;

  let jid: string;
  try {
    jid = normalizeWhatsAppGroupJid(settings.whatsappGroupJid);
  } catch (e) {
    logger.warn({ groupId, err: (e as Error).message }, 'invalid whatsapp group jid');
    return false;
  }

  let logStatus: WhatsappLogStatus = WhatsappLogStatus.failed;
  let errorMessage: string | undefined;
  let evolutionResponse: unknown = null;

  try {
    const result = await sendWhatsAppText(jid, message);
    evolutionResponse = result.data ?? null;
    if (result.ok) {
      logStatus = WhatsappLogStatus.sent;
    } else {
      errorMessage = result.error;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  await prisma.whatsappLog.create({
    data: {
      toPhone: jid,
      message,
      status: logStatus,
      attempts: 1,
      evolutionResponse: (evolutionResponse as object) ?? undefined,
      errorMessage,
    },
  });

  return logStatus === WhatsappLogStatus.sent;
}

export async function notifyGroup(
  groupId: string,
  message: string,
): Promise<void> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { name: true, settings: { select: { whatsappGroupJid: true } } },
  });
  if (!group?.settings?.whatsappGroupJid) return;
  const text = `*${group.name}*\n\n${message}\n\n— Chilimba`;
  sendGroupWhatsApp(groupId, text).catch((e) =>
    logger.warn({ err: e.message, groupId }, 'group WhatsApp notification failed'),
  );
}