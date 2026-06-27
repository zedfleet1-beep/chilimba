/**
 * Central error handler. Everything funnels through here.
 * Standard response shape: { success: false, error: { code, message } }.
 */
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const requestId = req.requestId;

  if (err instanceof ZodError) {
    const validation = new ValidationError('Invalid input', err.flatten().fieldErrors);
    logger.warn({ requestId, errors: err.flatten().fieldErrors }, 'validation failed');
    res.status(validation.httpCode).json({
      success: false,
      error: {
        code: validation.code,
        message: validation.message,
        details: validation.details,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    const level = err.httpCode >= 500 ? 'error' : 'warn';
    logger[level]({ requestId, code: err.code, httpCode: err.httpCode, msg: err.message }, 'app error');
    res.status(err.httpCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Unknown error: don't leak details to the client.
  logger.error({ requestId, err: { name: err.name, message: err.message, stack: err.stack } }, 'unhandled error');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL',
      message: 'Something went wrong. Please try again.',
    },
  });
}
