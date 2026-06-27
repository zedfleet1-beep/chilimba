/**
 * Route-level helpers shared by every module's *.routes.ts.
 * Extracted from auth.routes.ts so we don't copy-paste the wrapper boilerplate.
 */
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/**
 * Wrap an async handler so any thrown error funnels into the central
 * `errorHandler` via `next(err)`.
 *
 *   router.post('/x', ah(async (req, res) => { ... }));
 */
export function ah(
  fn: (req: Request, res: Response) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

/**
 * Run Zod validation and rethrow ZodError as-is so the central errorHandler
 * can format it into `{ success: false, error: { code: 'VALIDATION_FAILED', ... } }`.
 */
export function parseBody<T>(schema: { parse: (data: unknown) => T }, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) throw err;
    throw err;
  }
}
