/**
 * Group + member integration tests. Supertest + real DB.
 */
import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signGroupCreationToken, verifyGroupCreationToken } from '@/lib/jwt';
import { GroupTemplate, GroupMemberRole } from '@prisma/client';
import { applyTemplateDefaults } from './groups.service';

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
const OWNER_PHONE = '+260975000111';
const OTHER_PHONE = '+260975000222';
const PASSWORD = 'P@ssw0rd!1';

async function ensureUser(phone: string, firstName: string, role: 'member' | 'super_admin' = 'member') {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  return prisma.user.upsert({
    where: { phone },
    update: {},
    create: { firstName, lastName: 'Test', phone, passwordHash, otpVerified: true, role },
  });
}

async function tokenFor(phone: string) {
  await ensureUser(phone, 'User');
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ phone, password: PASSWORD });
  return res.body.data.accessToken;
}

async function seedPaidInvoiceWithOwner(phone: string, ownerFirstName: string) {
  // Create the owner user (already created by tokenFor).
  const owner = await prisma.user.findUniqueOrThrow({ where: { phone } });
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerName: `${ownerFirstName} Test`,
      phone,
      amountNgwe: 50000n,
      status: 'paid',
      paidAt: new Date(),
    },
  });
  return { owner, invoice };
}

async function cleanup() {
  // Wipe in FK-safe order
  await prisma.groupMember.deleteMany({});
  await prisma.groupSetting.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.paymentProof.deleteMany({});
  await prisma.invoice.deleteMany({
    where: { phone: { in: [ADMIN_PHONE, OWNER_PHONE, OTHER_PHONE] } },
  });
  await prisma.user.deleteMany({
    where: { phone: { in: [ADMIN_PHONE, OWNER_PHONE, OTHER_PHONE] } },
  });
}

describeIf('groups (applyTemplateDefaults — pure unit)', () => {
  it('rotating_cash → 2 recipients, 20 members, no loans', () => {
    const d = applyTemplateDefaults(GroupTemplate.rotating_cash);
    expect(d.maxMembers).toBe(20);
    expect(d.payoutRecipientsCount).toBe(2);
    expect(d.allowLoans).toBe(false);
  });
  it('grocery → 0 recipients, 20 members, loans on at 20%', () => {
    const d = applyTemplateDefaults(GroupTemplate.grocery);
    expect(d.maxMembers).toBe(20);
    expect(d.payoutRecipientsCount).toBe(1);
    expect(d.allowLoans).toBe(true);
    expect(d.loanInterestRate).toBe(0.2);
  });
  it('custom → 1 recipient, 10 members, no loans', () => {
    const d = applyTemplateDefaults(GroupTemplate.custom);
    expect(d.maxMembers).toBe(10);
    expect(d.payoutRecipientsCount).toBe(1);
    expect(d.allowLoans).toBe(false);
  });
});

describeIf('groups (HTTP)', () => {
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('create-from-token happy path (rotating_cash) → group, settings, owner member', async () => {
    const { invoice } = await seedPaidInvoiceWithOwner(OWNER_PHONE, 'Mary');
    const token = signGroupCreationToken({ invoiceId: invoice.id, phone: invoice.phone });

    const res = await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Lusaka Chilimba', template: 'rotating_cash', country: 'ZM', currency: 'ZMW' });
    expect(res.status).toBe(201);
    expect(res.body.data.group.name).toBe('Lusaka Chilimba');
    expect(res.body.data.group.template).toBe('rotating_cash');
    expect(res.body.data.owner.role).toBe(GroupMemberRole.owner);
    expect(res.body.data.owner.payoutPosition).toBe(1);

    const groupId = res.body.data.group.id;
    const settings = await prisma.groupSetting.findUniqueOrThrow({ where: { groupId } });
    expect(settings.payoutRecipientsCount).toBe(2);
    expect(settings.maxMembers).toBe(20);
  });

  it('create-from-token with already-linked invoice → 409', async () => {
    const { invoice } = await seedPaidInvoiceWithOwner(OWNER_PHONE, 'Mary');
    // First call — succeeds
    const token1 = signGroupCreationToken({ invoiceId: invoice.id, phone: invoice.phone });
    await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'First', template: 'rotating_cash' });

    // Second call with a new token — invoice is now linked
    const token2 = signGroupCreationToken({ invoiceId: invoice.id, phone: invoice.phone });
    const res = await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${token2}`)
      .send({ name: 'Second', template: 'rotating_cash' });
    expect(res.status).toBe(409);
  });

  it('create-from-token with non-paid invoice → 409', async () => {
    const { invoice } = await seedPaidInvoiceWithOwner(OWNER_PHONE, 'Mary');
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'pending', paidAt: null } });
    const token = signGroupCreationToken({ invoiceId: invoice.id, phone: invoice.phone });
    const res = await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X', template: 'custom' });
    expect(res.status).toBe(409);
  });

  it('create-from-token with mismatched phone → 403', async () => {
    const { invoice } = await seedPaidInvoiceWithOwner(OWNER_PHONE, 'Mary');
    const token = signGroupCreationToken({ invoiceId: invoice.id, phone: OTHER_PHONE });
    const res = await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X', template: 'custom' });
    expect(res.status).toBe(403);
  });

  it('listMyGroups returns only groups the caller is a member of', async () => {
    const { invoice } = await seedPaidInvoiceWithOwner(OWNER_PHONE, 'Mary');
    const token = signGroupCreationToken({ invoiceId: invoice.id, phone: invoice.phone });
    const create = await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Group', template: 'custom' });
    const groupId = create.body.data.group.id;

    const ownerToken = await tokenFor(OWNER_PHONE);
    const list = await request(app)
      .get('/api/v1/groups')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: groupId, myRole: 'owner' })]),
    );
  });

  it('non-member cannot GET /groups/:id → 403', async () => {
    const { invoice } = await seedPaidInvoiceWithOwner(OWNER_PHONE, 'Mary');
    const token = signGroupCreationToken({ invoiceId: invoice.id, phone: invoice.phone });
    const created = await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X', template: 'custom' });

    const otherToken = await tokenFor(OTHER_PHONE);
    const res = await request(app)
      .get(`/api/v1/groups/${created.body.data.group.id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  it('owner can update settings (BigInt round-trip)', async () => {
    const { invoice } = await seedPaidInvoiceWithOwner(OWNER_PHONE, 'Mary');
    const token = signGroupCreationToken({ invoiceId: invoice.id, phone: invoice.phone });
    const created = await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X', template: 'custom' });
    const groupId = created.body.data.group.id;

    const ownerToken = await tokenFor(OWNER_PHONE);
    const res = await request(app)
      .put(`/api/v1/groups/${groupId}/settings`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ contributionAmountNgwe: 75000, maxMembers: 15, name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(String(res.body.data.contributionAmountNgwe)).toBe('75000');
    expect(res.body.data.maxMembers).toBe(15);

    const refreshed = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
    expect(refreshed.name).toBe('Renamed');
  });

  it('non-owner cannot update settings → 403', async () => {
    const { invoice } = await seedPaidInvoiceWithOwner(OWNER_PHONE, 'Mary');
    const token = signGroupCreationToken({ invoiceId: invoice.id, phone: invoice.phone });
    const created = await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X', template: 'custom' });
    const groupId = created.body.data.group.id;

    // Add OTHER as a 'member'
    const ownerToken = await tokenFor(OWNER_PHONE);
    await request(app)
      .post(`/api/v1/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'Other', lastName: 'Person', phone: OTHER_PHONE, role: 'member' });
    const otherToken = await tokenFor(OTHER_PHONE);
    const res = await request(app)
      .put(`/api/v1/groups/${groupId}/settings`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ maxMembers: 30 });
    expect(res.status).toBe(403);
  });

  it('token round-trip (sign + verify)', () => {
    const t = signGroupCreationToken({ invoiceId: 'inv-1', phone: '+260971234567' });
    const v = verifyGroupCreationToken(t);
    expect(v.invoiceId).toBe('inv-1');
    expect(v.phone).toBe('+260971234567');
    expect(v.purpose).toBe('group_creation');
  });
});
