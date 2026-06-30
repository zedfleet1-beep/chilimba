/**
 * Invoice integration tests. Supertest + real DB.
 * Skipped when DATABASE_URL/REDIS_URL are unavailable.
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
const ADMIN_PHONE = '+260970000000';
const CUSTOMER_PHONE = '+260973000111';
const OTHER_CUSTOMER_PHONE = '+260973000222';
const ADMIN_PASSWORD = 'P@ssw0rd!1';
const CUSTOMER_PASSWORD = 'P@ssw0rd!1';

async function ensureUser(phone: string, firstName: string, role: 'member' | 'super_admin' = 'member') {
  const passwordHash = await bcrypt.hash(role === 'super_admin' ? ADMIN_PASSWORD : CUSTOMER_PASSWORD, 12);
  return prisma.user.upsert({
    where: { phone },
    update: {},
    create: {
      firstName,
      lastName: 'Test',
      phone,
      passwordHash,
      otpVerified: true,
      role,
    },
  });
}

async function cleanup() {
  // Cascading deletes via invoice
  await prisma.paymentProof.deleteMany({
    where: { invoice: { phone: { in: [CUSTOMER_PHONE, OTHER_CUSTOMER_PHONE, ADMIN_PHONE] } } },
  });
  await prisma.invoice.deleteMany({
    where: { phone: { in: [CUSTOMER_PHONE, OTHER_CUSTOMER_PHONE, ADMIN_PHONE] } },
  });
  await prisma.user.deleteMany({
    where: { phone: { in: [CUSTOMER_PHONE, OTHER_CUSTOMER_PHONE, ADMIN_PHONE] } },
  });
}

async function adminToken(): Promise<string> {
  await ensureUser(ADMIN_PHONE, 'Admin', 'super_admin');
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ phone: ADMIN_PHONE, password: ADMIN_PASSWORD });
  return res.body.data.accessToken;
}

async function customerToken(phone = CUSTOMER_PHONE, name = 'Cust'): Promise<string> {
  await ensureUser(phone, name, 'member');
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ phone, password: CUSTOMER_PASSWORD });
  return res.body.data.accessToken;
}

describeIf('invoices', () => {
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('non-admin cannot create invoice (403)', async () => {
    const token = await customerToken();
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerName: 'X', phone: '+260973000300', amountNgwe: 50000 });
    expect(res.status).toBe(403);
  });

  it('admin creates invoice and returns INV0001 with pending status', async () => {
    const token = await adminToken();
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Mary Banda',
        phone: CUSTOMER_PHONE,
        amountNgwe: 50000,
        description: 'Monthly plan',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.invoiceNumber).toBe('INV0001');
    expect(res.body.data.status).toBe('pending');
    expect(String(res.body.data.amountNgwe)).toBe('50000');
  });

  it('two creates produce sequential numbers', async () => {
    const token = await adminToken();
    const a = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerName: 'A', phone: '+260973000301', amountNgwe: 100 });
    const b = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerName: 'B', phone: '+260973000302', amountNgwe: 100 });
    expect(a.body.data.invoiceNumber).toBe('INV0001');
    expect(b.body.data.invoiceNumber).toBe('INV0002');
  });

  it('rejects negative amountNgwe', async () => {
    const token = await adminToken();
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerName: 'X', phone: '+260973000303', amountNgwe: -10 });
    expect(res.status).toBe(400);
  });

  it('rejects unknown fields (strict)', async () => {
    const token = await adminToken();
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerName: 'X', phone: '+260973000304', amountNgwe: 100, sneaky: 'hi' });
    expect(res.status).toBe(400);
  });

  it('customer can only read their own invoice (403 on someone else)', async () => {
    const admin = await adminToken();
    const created = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${admin}`)
      .send({ customerName: 'Mary', phone: CUSTOMER_PHONE, amountNgwe: 100 });

    const other = await customerToken(OTHER_CUSTOMER_PHONE, 'Other');
    const res = await request(app)
      .get(`/api/v1/invoices/${created.body.data.id}`)
      .set('Authorization', `Bearer ${other}`);
    expect(res.status).toBe(403);
  });

  it('customer can read their own invoice', async () => {
    const admin = await adminToken();
    const created = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${admin}`)
      .send({ customerName: 'Mary', phone: CUSTOMER_PHONE, amountNgwe: 100 });

    const token = await customerToken();
    const res = await request(app)
      .get(`/api/v1/invoices/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(created.body.data.id);
    expect(res.body.data.paymentProofs).toEqual([]);
  });

  it('GET /invoices/mine returns only the caller invoices', async () => {
    const admin = await adminToken();
    await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${admin}`)
      .send({ customerName: 'A', phone: CUSTOMER_PHONE, amountNgwe: 100 });
    await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${admin}`)
      .send({ customerName: 'B', phone: OTHER_CUSTOMER_PHONE, amountNgwe: 100 });

    const customer = await customerToken();
    const res = await request(app)
      .get('/api/v1/invoices/mine')
      .set('Authorization', `Bearer ${customer}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].phone).toBe(CUSTOMER_PHONE);
  });

  it('POST /invoices/:id/pop (multipart) creates a payment_proofs row with status=pending', async () => {
    const admin = await adminToken();
    const created = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${admin}`)
      .send({ customerName: 'Mary', phone: CUSTOMER_PHONE, amountNgwe: 100 });

    const token = await adminToken();
    // 1x1 transparent PNG (smallest valid PNG).
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64',
    );
    const res = await request(app)
      .post(`/api/v1/invoices/${created.body.data.id}/pop`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', tinyPng, { filename: 'proof.png', contentType: 'image/png' });
    // Skips cleanly when Cloudinary isn't configured in the test env.
    if (res.status === 503) return;
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.invoiceId).toBe(created.body.data.id);
    expect(res.body.data.fileUrl).toBeTruthy();
    expect(res.body.data.fileType).toBe('png');
  });

  it('uploadPop on a non-pending invoice is rejected (409)', async () => {
    const admin = await adminToken();
    const created = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${admin}`)
      .send({ customerName: 'Mary', phone: CUSTOMER_PHONE, amountNgwe: 100 });
    await prisma.invoice.update({
      where: { id: created.body.data.id },
      data: { status: 'cancelled' },
    });
    const token = await adminToken();
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64',
    );
    const res = await request(app)
      .post(`/api/v1/invoices/${created.body.data.id}/pop`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', tinyPng, { filename: 'proof.png', contentType: 'image/png' });
    // Skip the assertion if Cloudinary isn't configured in the test env
    // (the request would 503 before the invoice-status check).
    if (res.status === 503) return;
    expect(res.status).toBe(409);
  });

  it('customer can upload POP for their own invoice', async () => {
    const admin = await adminToken();
    const created = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${admin}`)
      .send({ customerName: 'Mary', phone: CUSTOMER_PHONE, amountNgwe: 100 });

    const token = await customerToken();
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64',
    );
    const res = await request(app)
      .post(`/api/v1/invoices/${created.body.data.id}/pop`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', tinyPng, { filename: 'proof.png', contentType: 'image/png' });
    if (res.status === 503) return;
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.invoiceId).toBe(created.body.data.id);
  });

  it('admin can record cash payment on a pending invoice', async () => {
    const admin = await adminToken();
    const created = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${admin}`)
      .send({ customerName: 'Mary', phone: CUSTOMER_PHONE, amountNgwe: 100 });

    const res = await request(app)
      .post(`/api/v1/invoices/${created.body.data.id}/record-cash`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ notes: 'Paid in cash at office' });
    expect(res.status).toBe(200);
    expect(res.body.data.invoice.status).toBe('paid');
    expect(res.body.data.paymentProof.status).toBe('approved');
    expect(res.body.data.paymentProof.notes).toBe('Paid in cash at office');
    expect(res.body.data.groupCreationToken).toBeTruthy();
    expect(res.body.data.groupCreationLink).toContain('/create-group?token=');
  });

  it('customer cannot record cash payment (403)', async () => {
    const admin = await adminToken();
    const created = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${admin}`)
      .send({ customerName: 'Mary', phone: CUSTOMER_PHONE, amountNgwe: 100 });

    const token = await customerToken();
    const res = await request(app)
      .post(`/api/v1/invoices/${created.body.data.id}/record-cash`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('customer cannot upload POP for someone else invoice (403)', async () => {
    const admin = await adminToken();
    const created = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${admin}`)
      .send({ customerName: 'Mary', phone: CUSTOMER_PHONE, amountNgwe: 100 });

    const token = await customerToken(OTHER_CUSTOMER_PHONE, 'Other');
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64',
    );
    const res = await request(app)
      .post(`/api/v1/invoices/${created.body.data.id}/pop`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', tinyPng, { filename: 'proof.png', contentType: 'image/png' });
    if (res.status === 503) return;
    expect(res.status).toBe(403);
  });
});
