/**
 * Express app. Mounts middleware, routers, error handler.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './env';
import { requestIdMiddleware, httpLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import invoicesRoutes from './modules/invoices/invoices.routes';
import paymentProofsRoutes from './modules/payment-proofs/payment-proofs.routes';
import groupsRoutes from './modules/groups/groups.routes';
import whatsappGroupLinkRoutes from './modules/groups/whatsappGroupLink.routes';
import paymentSettingsRoutes from './modules/payment-settings/payment-settings.routes';
import cyclesRoutes from './modules/cycles/cycles.routes';
import contributionsRoutes from './modules/contributions/contributions.routes';
import payoutsRoutes from './modules/payouts/payouts.routes';
import adminCyclesRoutes from './modules/cycles/adminCycles.routes';
import adminRoutes from './modules/admin/admin.routes';
import reportsRoutes from './modules/reports/reports.routes';
import loansRoutes from './modules/loans/loans.routes';
import { prisma } from './lib/prisma';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getConnection } from './lib/queue';

export function createApp() {
  const app = express();

  app.use(requestIdMiddleware);
  app.use(httpLogger);
  app.use(helmet());
  app.use(
    cors({
      origin: env.NODE_ENV === 'development' ? true : env.WEB_BASE_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  // BigInt-safe JSON serialization. Prisma returns BigInt for money columns
  // and JSON.stringify can't serialize them. We convert to strings — the
  // frontend `formatNgwe` helper accepts both BigInt and string, so this
  // is a no-op for callers.
  app.set('json replacer', (_key: string, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  );

  // Health
  app.get('/health', async (_req, res) => {
    const services: Record<string, string> = { db: 'ok', redis: 'ok', s3: 'ok' };
    let allOk = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      services.db = 'down';
      allOk = false;
    }
    try {
      await getConnection().ping();
    } catch {
      services.redis = 'down';
      allOk = false;
    }
    try {
      const s3 = new S3Client({
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
        credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
      });
      await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    } catch {
      services.s3 = 'down';
      allOk = false;
    }
    res.status(allOk ? 200 : 503).json({
      success: allOk,
      data: { status: allOk ? 'ok' : 'degraded', services },
    });
  });

  // API
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/invoices', invoicesRoutes);
  app.use('/api/v1/payment-proofs', paymentProofsRoutes);
  app.use('/api/v1/admin/pops', paymentProofsRoutes);
  app.use('/api/v1/groups', groupsRoutes);
  app.use('/api/v1/groups/:id/whatsapp', whatsappGroupLinkRoutes);
  app.use('/api/v1/groups/:id/cycles', cyclesRoutes);
  app.use('/api/v1/groups/:id/cycles/:cid/rounds/:rid/contributions', contributionsRoutes);
  app.use('/api/v1/groups/:id/cycles/:cid/rounds/:rid/payouts', payoutsRoutes);
  app.use('/api/v1/groups/:id/reports', reportsRoutes);
  app.use('/api/v1/groups/:id/loans', loansRoutes);
  app.use('/api/v1/payment-settings', paymentSettingsRoutes);
  app.use('/api/v1/admin/cycles', adminCyclesRoutes);
  app.use('/api/v1/admin', adminRoutes);

  // 404 + error handler
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
