/**
 * Server entrypoint. Starts the API and the notification + late-detection
 * workers in the same Node process (dev convenience). In production, run
 * each worker separately with `npm run worker`.
 */
import { createApp } from './app';
import { env } from './env';
import { logger } from './lib/logger';
import { startNotificationWorker } from './workers/notification.worker';
import { startLateDetectionWorker } from './modules/cycles/lateDetection';
import { startContributionReminderWorker } from './modules/cycles/contributionReminders';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, '🚀 Chilimba API listening');
});

// Start the workers. Both are best-effort — if Redis is down, they
// log a warning and the API still serves traffic.
try {
  startNotificationWorker();
  logger.info('notification worker started');
} catch (e) {
  logger.warn({ err: (e as Error).message }, 'notification worker failed to start');
}
try {
  startLateDetectionWorker();
  logger.info('late-detection worker started');
} catch (e) {
  logger.warn({ err: (e as Error).message }, 'late-detection worker failed to start');
}
try {
  startContributionReminderWorker();
  logger.info('contribution-reminder worker started');
} catch (e) {
  logger.warn({ err: (e as Error).message }, 'contribution-reminder worker failed to start');
}

function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}


process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
