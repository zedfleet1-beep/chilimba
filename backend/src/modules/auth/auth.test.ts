/**
 * Auth integration tests. Hits a real Express app instance with a real DB.
 * Requires:
 *   - DATABASE_URL pointing at a test database
 *   - REDIS_URL pointing at a real redis
 * Tests are skipped automatically if these are not available.
 */
import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';

// Provide a default test env if none is set
process.env.DATABASE_URL ||= 'postgresql://chilimba:chilimba_dev@localhost:5432/chilimba_test?schema=public';
process.env.REDIS_URL ||= 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-please-change-32-chars-min';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-please-change-32-chars-min';
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
const TEST_PHONE = '+260971111111';
const TEST_PASSWORD = 'P@ssw0rd!';

async function cleanup() {
  await prisma.otp.deleteMany({ where: { user: { phone: TEST_PHONE } } });
  await prisma.user.deleteMany({ where: { phone: TEST_PHONE } });
}

describeIf('auth', () => {
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('signs up a new user and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        firstName: 'Mary',
        lastName: 'Banda',
        phone: TEST_PHONE,
        password: TEST_PASSWORD,
        consent: true,
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      success: true,
      data: { userId: expect.any(String), phone: TEST_PHONE },
    });
  });

  it('rejects duplicate phone with PHONE_ALREADY_EXISTS', async () => {
    await request(app)
      .post('/api/v1/auth/signup')
      .send({
        firstName: 'Mary',
        lastName: 'Banda',
        phone: TEST_PHONE,
        password: TEST_PASSWORD,
        consent: true,
      });
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        firstName: 'Mary',
        lastName: 'Banda',
        phone: TEST_PHONE,
        password: TEST_PASSWORD,
        consent: true,
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHONE_ALREADY_EXISTS');
  });

  it('rejects missing consent with 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        firstName: 'Mary',
        lastName: 'Banda',
        phone: TEST_PHONE,
        password: TEST_PASSWORD,
      });
    expect(res.status).toBe(400);
  });

  it('rejects weak password with 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        firstName: 'Mary',
        lastName: 'Banda',
        phone: TEST_PHONE,
        password: 'weak',
        consent: true,
      });
    expect(res.status).toBe(400);
  });

  it('login fails with OTP_NOT_VERIFIED for unverified user', async () => {
    await request(app)
      .post('/api/v1/auth/signup')
      .send({
        firstName: 'Mary',
        lastName: 'Banda',
        phone: TEST_PHONE,
        password: TEST_PASSWORD,
        consent: true,
      });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: TEST_PHONE, password: TEST_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('OTP_NOT_VERIFIED');
  });

  it('login succeeds after OTP verify and returns tokens', async () => {
    // Signup
    await request(app)
      .post('/api/v1/auth/signup')
      .send({
        firstName: 'Mary',
        lastName: 'Banda',
        phone: TEST_PHONE,
        password: TEST_PASSWORD,
        consent: true,
      });
    // Pull the latest OTP from DB
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: TEST_PHONE } });
    const otp = await prisma.otp.findFirstOrThrow({
      where: { userId: user.id, used: false },
      orderBy: { createdAt: 'desc' },
    });
    // Verify
    const verifyRes = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ phone: TEST_PHONE, code: otp.code });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      user: { phone: TEST_PHONE, otpVerified: true },
    });
    // Login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: TEST_PHONE, password: TEST_PASSWORD });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.accessToken).toBeTruthy();
  });

  it('rejects wrong OTP code', async () => {
    await request(app)
      .post('/api/v1/auth/signup')
      .send({
        firstName: 'Mary',
        lastName: 'Banda',
        phone: TEST_PHONE,
        password: TEST_PASSWORD,
        consent: true,
      });
    const res = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ phone: TEST_PHONE, code: '000000' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 from /auth/me without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns user from /auth/me with valid token', async () => {
    await request(app)
      .post('/api/v1/auth/signup')
      .send({
        firstName: 'Mary',
        lastName: 'Banda',
        phone: TEST_PHONE,
        password: TEST_PASSWORD,
        consent: true,
      });
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: TEST_PHONE } });
    const otp = await prisma.otp.findFirstOrThrow({
      where: { userId: user.id, used: false },
      orderBy: { createdAt: 'desc' },
    });
    const verify = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ phone: TEST_PHONE, code: otp.code });
    const token = verify.body.data.accessToken;
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe(TEST_PHONE);
  });
});
