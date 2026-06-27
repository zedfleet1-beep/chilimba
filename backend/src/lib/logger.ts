/**
 * pino logger. JSON in prod, pretty in dev.
 */
import pino from 'pino';
import { env } from '@/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'chilimba-backend' },
  ...(env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
    },
  }),
});
