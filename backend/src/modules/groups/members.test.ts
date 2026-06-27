/**
 * Group-members integration tests. Supertest + real DB.
 */
import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signGroupCreationToken } from '@/lib/jwt';

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
const OWNER_PHONE = '+260976000111';
const MEMBER_PHONE = '+260976000222';
const NEW_PHONE = '+260976000333';
const PASSWORD = 'P@ssw0rd!1';

async function ensureUser(phone: string, firstName: string) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  return prisma.user.upsert({
    where: { phone },
    update: {},
    create: { firstName, lastName: 'Test', phone, passwordHash, otpVerified: true, role: 'member' },
  });
}

async function tokenFor(phone: string) {
  await ensureUser(phone, 'User');
  const res = await request(app).post('/api/v1/auth/login').send({ phone, password: PASSWORD });
  return res.body.data.accessToken;
}

async function seedOwnerAndGroup() {
  await ensureUser(OWNER_PHONE, 'Mary');
  const owner = await prisma.user.findUniqueOrThrow({ where: { phone: OWNER_PHONE } });
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerName: 'Mary',
      phone: OWNER_PHONE,
      amountNgwe: 50000n,
      status: 'paid',
      paidAt: new Date(),
    },
  });
  const token = signGroupCreationToken({ invoiceId: invoice.id, phone: invoice.phone });
  const res = await request(app)
    .post('/api/v1/groups')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Group', template: 'custom' });
  return { owner, groupId: res.body.data.group.id, invoice };
}

async function cleanup() {
  await prisma.groupMember.deleteMany({});
  await prisma.groupSetting.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.paymentProof.deleteMany({});
  await prisma.invoice.deleteMany({
    where: { phone: { in: [OWNER_PHONE, MEMBER_PHONE, NEW_PHONE] } },
  });
  await prisma.user.deleteMany({
    where: { phone: { in: [OWNER_PHONE, MEMBER_PHONE, NEW_PHONE] } },
  });
}

describeIf('group-members', () => {
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('addMember happy path creates a new user when missing, with auto payoutPosition', async () => {
    const { groupId } = await seedOwnerAndGroup();
    const ownerToken = await tokenFor(OWNER_PHONE);

    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'New', lastName: 'Person', phone: NEW_PHONE, role: 'member' });
    expect(res.status).toBe(201);
    expect(res.body.data.payoutPosition).toBeGreaterThanOrEqual(2);

    // The user was created in the users table.
    const u = await prisma.user.findUnique({ where: { phone: NEW_PHONE } });
    expect(u).toBeTruthy();
    expect(u?.firstName).toBe('New');
  });

  it('addMember duplicate phone → 409 ALREADY_A_MEMBER', async () => {
    const { groupId } = await seedOwnerAndGroup();
    const ownerToken = await tokenFor(OWNER_PHONE);
    await request(app)
      .post(`/api/v1/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'M', lastName: 'P', phone: NEW_PHONE });

    const dup = await request(app)
      .post(`/api/v1/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'M', lastName: 'P', phone: NEW_PHONE });
    expect(dup.status).toBe(409);
  });

  it('addMember by a member-role user → 403', async () => {
    const { groupId } = await seedOwnerAndGroup();
    // Add MEMBER_PHONE as 'member' first
    const ownerToken = await tokenFor(OWNER_PHONE);
    await request(app)
      .post(`/api/v1/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'M', lastName: 'P', phone: MEMBER_PHONE, role: 'member' });
    const memberToken = await tokenFor(MEMBER_PHONE);

    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ firstName: 'X', lastName: 'Y', phone: NEW_PHONE });
    expect(res.status).toBe(403);
  });

  it('addMember when group is at capacity → 409 GROUP_FULL', async () => {
    const { groupId } = await seedOwnerAndGroup();
    const ownerToken = await tokenFor(OWNER_PHONE);
    // Lower maxMembers to 2 (1 owner already exists, so 1 more is allowed)
    await request(app)
      .put(`/api/v1/groups/${groupId}/settings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ maxMembers: 2 });
    // Add 1 member — should succeed
    const ok = await request(app)
      .post(`/api/v1/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'A', lastName: 'A', phone: NEW_PHONE });
    expect(ok.status).toBe(201);
    // Add another — should fail
    const full = await request(app)
      .post(`/api/v1/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'B', lastName: 'B', phone: MEMBER_PHONE });
    expect(full.status).toBe(409);
  });

  it('updateMember swaps payout positions transactionally', async () => {
    const { groupId } = await seedOwnerAndGroup();
    const ownerToken = await tokenFor(OWNER_PHONE);
    const a = await request(app)
      .post(`/api/v1/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'A', lastName: 'A', phone: NEW_PHONE });
    const b = await request(app)
      .post(`/api/v1/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'B', lastName: 'B', phone: MEMBER_PHONE });

    // Swap A's position to B's position
    const targetPos = b.body.data.payoutPosition;
    await request(app)
      .put(`/api/v1/groups/${groupId}/members/${a.body.data.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ payoutPosition: targetPos });

    const after = await prisma.groupMember.findUniqueOrThrow({ where: { id: a.body.data.id } });
    const bAfter = await prisma.groupMember.findUniqueOrThrow({ where: { id: b.body.data.id } });
    expect(after.payoutPosition).toBe(targetPos);
    expect(bAfter.payoutPosition).not.toBe(targetPos);
  });

  it('removeMember soft-deletes (status=exited, exitedAt set)', async () => {
    const { groupId } = await seedOwnerAndGroup();
    const ownerToken = await tokenFor(OWNER_PHONE);
    const added = await request(app)
      .post(`/api/v1/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'X', lastName: 'X', phone: NEW_PHONE });

    const res = await request(app)
      .delete(`/api/v1/groups/${groupId}/members/${added.body.data.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('exited');
    expect(res.body.data.exitedAt).toBeTruthy();
  });
});
