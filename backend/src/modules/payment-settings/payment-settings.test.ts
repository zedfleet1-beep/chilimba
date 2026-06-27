/**
 * Payment-settings integration tests. Supertest + real DB.
 */
import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

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
const ADMIN_PHONE = '+260970990111';
const CUSTOMER_PHONE = '+260970990222';
const PASSWORD = 'P@ssw0rd!1';

async function ensureUser(phone: string, firstName: string, role: 'member' | 'super_admin' = 'member') {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
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
    .send({ phone: ADMIN_PHONE, password: PASSWORD });
  return res.body.data.accessToken;
}

async function customerToken() {
  await ensureUser(CUSTOMER_PHONE, 'Cust', 'member');
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ phone: CUSTOMER_PHONE, password: PASSWORD });
  return res.body.data.accessToken;
}

async function cleanup() {
  await prisma.paymentSetting.deleteMany({
    where: {
      OR: [
        { invoice: { phone: { in: [ADMIN_PHONE, CUSTOMER_PHONE] } } },
        { invoiceId: null },
      ],
    },
  });
  await prisma.invoice.deleteMany({
    where: { phone: { in: [ADMIN_PHONE, CUSTOMER_PHONE] } },
  });
  await prisma.user.deleteMany({
    where: { phone: { in: [ADMIN_PHONE, CUSTOMER_PHONE] } },
  });
}

async function seedPaidInvoice() {
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `INV-${Date.now()}`,
      customerName: 'Test',
      phone: CUSTOMER_PHONE,
      amountNgwe: 50000n,
      status: 'pending',
    },
  });
  return invoice;
}

describeIf('payment-settings', () => {
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('platform default upsert is a singleton (second upsert updates, not creates)', async () => {
    const token = await adminToken();

    await request(app)
      .put('/api/v1/payment-settings/platform')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMethod: 'mobile_money',
        mobileMoneyProvider: 'mtn',
        accountName: 'Chilimba A',
        accountNumber: '+260971111111',
        reference: 'Use invoice number',
      });
    await request(app)
      .put('/api/v1/payment-settings/platform')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMethod: 'mobile_money',
        mobileMoneyProvider: 'airtel',
        accountName: 'Chilimba B',
        accountNumber: '+260972222222',
      });

    const all = await prisma.paymentSetting.findMany({ where: { invoiceId: null } });
    expect(all).toHaveLength(1);
    expect(all[0].mobileMoneyProvider).toBe('airtel');
    expect(all[0].accountName).toBe('Chilimba B');
  });

  it('rejects mobile_money without a provider (400)', async () => {
    const token = await adminToken();
    const res = await request(app)
      .put('/api/v1/payment-settings/platform')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMethod: 'mobile_money',
        accountName: 'X',
        accountNumber: '+260971111111',
      });
    expect(res.status).toBe(400);
  });

  it('rejects mobile_money with a bankName (400)', async () => {
    const token = await adminToken();
    const res = await request(app)
      .put('/api/v1/payment-settings/platform')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMethod: 'mobile_money',
        mobileMoneyProvider: 'mtn',
        bankName: 'Some Bank',
        accountName: 'X',
        accountNumber: '+260971111111',
      });
    expect(res.status).toBe(400);
  });

  it('rejects bank without a bankName (400)', async () => {
    const token = await adminToken();
    const res = await request(app)
      .put('/api/v1/payment-settings/platform')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMethod: 'bank',
        accountName: 'X',
        accountNumber: '1234567890',
      });
    expect(res.status).toBe(400);
  });

  it('non-admin cannot read or write the platform default (403)', async () => {
    const token = await customerToken();

    const get = await request(app)
      .get('/api/v1/payment-settings/platform')
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(403);

    const put = await request(app)
      .put('/api/v1/payment-settings/platform')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMethod: 'mobile_money',
        mobileMoneyProvider: 'mtn',
        accountName: 'X',
        accountNumber: '+260971111111',
      });
    expect(put.status).toBe(403);
  });

  it('effective returns the invoice override when set, else the platform default', async () => {
    const token = await adminToken();

    // Set platform default
    await request(app)
      .put('/api/v1/payment-settings/platform')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMethod: 'mobile_money',
        mobileMoneyProvider: 'mtn',
        accountName: 'Platform',
        accountNumber: '+260970000000',
      });

    const invoice = await seedPaidInvoice();

    // No override yet → effective == platform default
    const before = await request(app)
      .get(`/api/v1/payment-settings/effective?invoiceId=${invoice.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);
    expect(before.body.data.accountName).toBe('Platform');
    expect(before.body.data.invoiceId).toBeNull();

    // Set invoice override
    await request(app)
      .put(`/api/v1/payment-settings/by-invoice/${invoice.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMethod: 'bank',
        bankName: 'Zanaco',
        accountName: 'This Invoice Only',
        accountNumber: '9876543210',
      });

    // Now effective should be the override
    const after = await request(app)
      .get(`/api/v1/payment-settings/effective?invoiceId=${invoice.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(200);
    expect(after.body.data.accountName).toBe('This Invoice Only');
    expect(after.body.data.invoiceId).toBe(invoice.id);
  });

  it('PUT by-invoice on a non-existent invoice → 404', async () => {
    const token = await adminToken();
    const res = await request(app)
      .put('/api/v1/payment-settings/by-invoice/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMethod: 'mobile_money',
        mobileMoneyProvider: 'mtn',
        accountName: 'X',
        accountNumber: '+260971111111',
      });
    expect(res.status).toBe(404);
  });
});
