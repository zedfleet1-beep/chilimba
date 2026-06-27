import { normalizePhone } from './phone';
import { ValidationError } from './errors';
import { sendWhatsAppText } from './evolution';
import { prisma } from './prisma';
import { WhatsappLogStatus } from '@prisma/client';
import { logger } from './logger';

/**
 * Send a WhatsApp message immediately and synchronously.
 * Matches techproof's direct-call pattern (no queuing).
 */
export async function sendWhatsApp(phone: string, message: string, notificationId?: string): Promise<void> {
  if (!phone || !phone.startsWith('+')) {
    throw new ValidationError('Phone must include country code (E.164)');
  }
  if (!message || message.trim().length === 0) {
    throw new ValidationError('Message body is required');
  }

  const normalized = normalizePhone(phone);
  
  let logStatus: WhatsappLogStatus = WhatsappLogStatus.failed;
  let errorMessage: string | undefined;
  let evolutionResponse: any = null;

  try {
    const result = await sendWhatsAppText(normalized, message);
    evolutionResponse = result.data ?? null;

    if (!result.ok) {
      errorMessage = result.error;
      // We don't throw here to avoid blocking the main auth flow (OTP already in DB)
      logger.warn({ phone: normalized, error: errorMessage }, 'WhatsApp send failed (synchronous)');
    } else {
      logStatus = WhatsappLogStatus.sent;
      logger.info({ phone: normalized, notificationId }, 'WhatsApp sent (synchronous)');
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ phone: normalized, err: errorMessage }, 'WhatsApp send crashed (synchronous)');
  }

  // Persist attempt to logs
  await prisma.whatsappLog.create({
    data: {
      notificationId: notificationId ?? null,
      toPhone: normalized,
      message,
      status: logStatus,
      attempts: 1, // Only one attempt in this sync flow
      evolutionResponse: (evolutionResponse as any) ?? undefined,
      errorMessage,
    },
  });

  if (notificationId) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: logStatus === WhatsappLogStatus.sent ? 'sent' : 'failed',
        sentAt: logStatus === WhatsappLogStatus.sent ? new Date() : null,
      },
    });
  }
}

export const otpTemplate = (code: string): string =>
  `Your Chilimba verification code is: ${code}\n\nValid for 10 minutes. Do not share this code.`;

export const welcomeTemplate = (firstName: string, phone: string): string =>
  `Welcome to Chilimba, ${firstName}!\n\nYour account has been created successfully.\nPhone: ${phone}\n\nYou can now join or create a savings group.`;

export const passwordResetTemplate = (code: string): string =>
  `Your Chilimba password reset code is: ${code}\n\nValid for 10 minutes. If you didn't request this, ignore this message.`;
