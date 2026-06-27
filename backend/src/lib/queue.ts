/**
 * BullMQ queue + worker singletons. Redis-backed.
 *
 * Both the queue and the worker build their connection lazily on first use
 * (not at module import), so dev / test runs without Redis don't spam the
 * console with ECONNREFUSED. After the first connection error, subsequent
 * errors are silenced.
 */
import { Queue, Worker, QueueOptions, Job, ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '@/env';
import { logger } from './logger';

export const QUEUE_NAME = 'notifications';

let _connection: IORedis | undefined;
let _queue: Queue | undefined;
let _errorLogged = false;

function buildConnection(): IORedis {
  if (_connection) return _connection;
  _connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // required for BullMQ
    lazyConnect: true, // wait for .connect() before opening the socket
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      if (env.NODE_ENV === 'development') {
        return Math.min(times * 1000, 10_000);
      }
      return Math.min(times * 500, 5_000);
    },
  });
  _connection.on('error', (err: Error) => {
    if (!_errorLogged) {
      _errorLogged = true;
      logger.warn(
        { err: err.message, redis: env.REDIS_URL },
        'Redis connection error (further errors suppressed at debug level)',
      );
    }
  });
  // Kick off the connect attempt. Errors land in the 'error' handler above.
  _connection.connect().catch(() => undefined);
  return _connection;
}

export function getConnection(): IORedis {
  return buildConnection();
}

function buildQueueOptions(): QueueOptions {
  return {
    connection: buildConnection() as unknown as ConnectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  };
}

export function getQueue(): Queue {
  if (_queue) return _queue;
  _queue = new Queue<WhatsAppJobData>(QUEUE_NAME, buildQueueOptions());
  return _queue;
}

export interface WhatsAppJobData {
  phone: string;
  message: string;
  notificationId?: string; // optional link to notifications row
}

export function startWhatsAppWorker(
  processor: (job: Job<WhatsAppJobData>) => Promise<void>,
): Worker<WhatsAppJobData> {
  const worker = new Worker<WhatsAppJobData>(QUEUE_NAME, processor, {
    connection: buildConnection() as unknown as ConnectionOptions,
    concurrency: 5,
  });
  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[worker] job ${job?.id} failed:`, err.message);
  });
  return worker;
}

/**
 * Generic helper for a cron-style scheduled worker. Used for the
 * late-detection job (daily at 00:00 UTC). Mirrors the existing
 * `startWhatsAppWorker` but accepts a cron expression and runs a
 * single-step handler.
 */
export interface ScheduledWorkerOptions<T> {
  queueName: string;
  cron: string;
  handler: (job: Job<T>) => Promise<void>;
}

export function startScheduledWorker<T>(opts: ScheduledWorkerOptions<T>): Worker<T> {
  const worker = new Worker<T>(opts.queueName, opts.handler, {
    connection: buildConnection() as unknown as ConnectionOptions,
    concurrency: 1,
  });
  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[${opts.queueName}] job ${job?.id} failed:`, err.message);
  });
  // Register the repeatable job. BullMQ requires the queue to also be
  // accessible for `add()` — we reuse the same connection.
  // We do this lazily so the dev server doesn't block on startup if
  // Redis isn't reachable.
  const repeat = { pattern: opts.cron };
  const queue = new Queue<T>(opts.queueName, {
    connection: buildConnection() as unknown as ConnectionOptions,
  });
  const addRepeatableJob = queue.add as unknown as (
    name: string,
    data: T,
    options: { repeat: { pattern: string } },
  ) => Promise<unknown>;
  addRepeatableJob(opts.queueName + '-tick', {} as T, { repeat })
    .then(() => logger.info({ queue: opts.queueName, cron: opts.cron }, 'scheduled worker registered'))
    .catch((e) => {
      // Likely Redis is down — log and continue. The worker is still
      // listening; manual triggers via the admin endpoint will work.
      logger.warn({ err: e.message, queue: opts.queueName }, 'failed to register scheduled worker');
    });
  return worker;
}
