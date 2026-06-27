/**
 * Payment-proofs integration tests. Supertest + real DB.
 */
import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { verifyGroupCreationToken } from '@/lib/jwt';

process.env.DATABASE_URL ||= 'postgresql://chilimba:chilimba_dev@localhost:5432/chilimba_test?schema=public';
process.env.REDIS_URL ||= 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-please-change-32-chars-min';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-please-change-32-chars-min';
process.env.JWT_GROUP_TOKEN_SECRET ||= 'test-group-token-secret-please-change-32-chars-min';
process.env.EVOLUTION_URL ||= 'http://localhost:8080';
process.env.EVOLUTION_INSTANCE ||= 'test';
process.env.EVOLUTION_API_KEY ||= 'test';
process.env.EVOLUTION_ENABLED ||= 'false';
process.env.S3_ENDPOINT ||= 'http://localhost:9000';
process.env.S3_BUCKET ||= 'chilimba-pops';
process.env.S3_ACCESS_KEY ||= 'chilimba_minio';
process.env.S3_SECRET_KEY ||= 'chilimba_minio_secret';
process.env.WEB_BASE_URL ||= 'http://localhost:5173';

const hasDb = !!process.env.DATABASE_URL;
const hasRedis = !!process.env.REDIS_URL;
const describeIf = hasDb && hasRedis ? describe : describe.skip;

const app = createApp();
const ADMIN_PHONE = '+260970000000';
const CUSTOMER_PHONE = '+260974000111';
const ADMIN_PASSWORD = 'P@ssw0rd!1';
const CUSTOMER_PASSWORD = 'P@ssw0rd!1';

async function ensureUser(phone: string, firstName: string, role: 'member' | 'super_admin' = 'member') {
  const passwordHash = await bcrypt.hash(role === 'super_admin' ? ADMIN_PASSWORD : CUSTOMER_PASSWORD, 12);
  return prisma.user.upsert({
    where: { phone },
    update: {},
    create: { firstName, lastName: 'Test', phone, passwordHash, otpVerified: true, role },
  });
}

async function adminToken() {
  await ensureUser(ADMIN_PHONE, 'Admin', 'super_admin');
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ phone: ADMIN_PHONE, password: ADMIN_PASSWORD });
  return res.body.data.accessToken;
}

async function customerToken() {
  const u = await ensureUser(CUSTOMER_PHONE, 'Mary', 'member');
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ phone: CUSTOMER_PHONE, password: CUSTOMER_PASSWORD });
  return { token: res.body.data.accessToken, userId: u.id };
}

async function cleanup() {
  await prisma.paymentProof.deleteMany({ where: { invoice: { phone: CUSTOMER_PHONE } } });
  await prisma.invoice.deleteMany({ where: { phone: CUSTOMER_PHONE } });
  await prisma.user.deleteMany({ where: { phone: { in: [CUSTOMER_PHONE, ADMIN_PHONE] } } });
}

async function seedPendingInvoiceAndPop() {
  const customer = await ensureUser(CUSTOMER_PHONE, 'Mary', 'member');
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `INV-${Date.now()}`,
      customerName: 'Mary Banda',
      phone: CUSTOMER_PHONE,
      amountNgwe: 50000n,
      description: 'Test',
      status: 'pending',
    },
  });
  const pop = await prisma.paymentProof.create({
    data: {
      invoiceId: invoice.id,
      uploadedById: customer.id,
      fileKey: 'pops/test.pdf',
      fileType: 'pdf',
      status: 'pending',
    },
  });
  return { invoice, pop };
}

describeIf('payment-proofs', () => {
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('approve happy path → invoice paid + valid 48h token', async () => {
    const token = await adminToken();
    const { pop, invoice } = await seedPendingInvoiceAndPop();

    const res = await request(app)
      .post(`/api/v1/admin/pops/${pop.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.invoice.status).toBe('paid');
    expect(res.body.data.invoice.paidAt).toBeTruthy();
    expect(res.body.data.paymentProof.status).toBe('approved');
    expect(res.body.data.groupCreationToken).toBeTruthy();
    expect(res.body.data.groupCreationLink).toContain('/create-group?token=');

    const decoded = verifyGroupCreationToken(res.body.data.groupCreationToken);
    expect(decoded.invoiceId).toBe(invoice.id);
    expect(decoded.phone).toBe(invoice.phone);
    expect(decoded.purpose).toBe('group_creation');
  });

  it('approve twice → 409 POP_ALREADY_REVIEWED', async () => {
    const token = await adminToken();
    const { pop } = await seedPendingInvoiceAndPop();

    await request(app)
      .post(`/api/v1/admin/pops/${pop.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    const second = await request(app)
      .post(`/api/v1/admin/pops/${pop.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(second.status).toBe(409);
  });

  it('reject requires a reason (400)', async () => {
    const token = await adminToken();
    const { pop } = await seedPendingInvoiceAndPop();
    const res = await request(app)
      .post(`/api/v1/admin/pops/${pop.id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('reject happy path → POP rejected with notes, invoice stays pending', async () => {
    const token = await adminToken();
    const { pop, invoice } = await seedPendingInvoiceAndPop();
    const res = await request(app)
      .post(`/api/v1/admin/pops/${pop.id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Image is too blurry' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.notes).toBe('Image is too blurry');

    const refreshed = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(refreshed.status).toBe('pending');
  });

  it('approve as non-admin → 403', async () => {
    const { token } = await customerToken();
    const { pop } = await seedPendingInvoiceAndPop();
    const res = await request(app)
      .post(`/api/v1/admin/pops/${pop.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('refresh-url returns a download URL for the owner', async () => {
    const { token } = await customerToken();
    const { pop } = await seedPendingInvoiceAndPop();
    const res = await request(app)
      .post(`/api/v1/payment-proofs/${pop.id}/refresh-url`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.url).toContain('pops/test.pdf');
    expect(res.body.data.expiresIn).toBe(600);
  });
});
