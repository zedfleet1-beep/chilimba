/**
 * Attaches a requestId to every request and logs request/response.
 */
import { v4 as uuid } from 'uuid';
import pinoHttp from 'pino-http';
import { Request, Response, NextFunction } from 'express';
import { logger } from '@/lib/logger';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const id = (req.headers['x-request-id'] as string) || uuid();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as Request).requestId ?? '',
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
