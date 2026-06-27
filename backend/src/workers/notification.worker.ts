/**
 * Notification worker. Consumes BullMQ 'send-whatsapp' jobs and calls
 * Evolution API. Logs every attempt to whatsapp_logs.
 */
import { Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { startWhatsAppWorker, WhatsAppJobData } from '@/lib/queue';
import { logger } from '@/lib/logger';
import { WhatsappLogStatus } from '@prisma/client';
import { sendWhatsAppText } from '@/lib/evolution';

async function processWhatsAppJob(job: Job<WhatsAppJobData>): Promise<void> {
  const { phone, message, notificationId } = job.data;
  const attemptNumber = job.attemptsMade + 1;
  let logStatus: WhatsappLogStatus = WhatsappLogStatus.failed;
  let errorMessage: string | undefined;
  let evolutionResponse: any = null;

  try {
    const result = await sendWhatsAppText(phone, message);
    evolutionResponse = result.data ?? null;

    if (!result.ok) {
      errorMessage = result.error;
      throw new Error(errorMessage);
    }

    logStatus = WhatsappLogStatus.sent;
    logger.info({ phone, notificationId, attempt: attemptNumber }, 'whatsapp sent');
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    logger.warn({ phone, attempt: attemptNumber, err: errorMessage }, 'whatsapp send failed');
    
    // We let BullMQ handle the overall job retries, but we've already done 
    // internal retries in sendWhatsAppText.
    throw err; 
  } finally {
    // Persist the attempt to whatsapp_logs regardless of success/failure
    await prisma.whatsappLog.create({
      data: {
        notificationId: notificationId ?? null,
        toPhone: phone,
        message,
        status: logStatus,
        attempts: attemptNumber,
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
}

export function startNotificationWorker() {
  return startWhatsAppWorker(processWhatsAppJob);
}
