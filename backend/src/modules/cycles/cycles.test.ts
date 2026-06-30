/**
 * Week 5-6 integration tests: cycles, contributions, payouts.
 */
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {
  ContributionStatus,
  CycleStatus,
  GroupMemberRole,
  GroupTemplate,
  RoundStatus,
} from '@prisma/client';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';

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
const PASSWORD = 'P@ssw0rd!1';
const PHONES = [
  '+260976100001',
  '+260976100002',
  '+260976100003',
  '+260976100004',
  '+260976100005',
];

async function cleanup() {
  await prisma.contribution.deleteMany({ where: { group: { invoice: { phone: { in: PHONES } } } } });
  await prisma.cyclePayout.deleteMany({ where: { member: { user: { phone: { in: PHONES } } } } });
  await prisma.cycleRound.deleteMany({ where: { cycle: { group: { invoice: { phone: { in: PHONES } } } } } });
  await prisma.cycle.deleteMany({ where: { group: { invoice: { phone: { in: PHONES } } } } });
  await prisma.groupMember.deleteMany({ where: { user: { phone: { in: PHONES } } } });
  await prisma.groupSetting.deleteMany({ where: { group: { invoice: { phone: { in: PHONES } } } } });
  await prisma.group.deleteMany({ where: { invoice: { phone: { in: PHONES } } } });
  await prisma.invoice.deleteMany({ where: { phone: { in: PHONES } } });
  await prisma.user.deleteMany({ where: { phone: { in: PHONES } } });
}

async function createUser(phone: string, firstName: string) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  return prisma.user.create({
    data: { phone, firstName, lastName: 'Tester', passwordHash, otpVerified: true },
  });
}

async function tokenFor(phone: string) {
  const res = await request(app).post('/api/v1/auth/login').send({ phone, password: PASSWORD });
  return res.body.data.accessToken as string;
}

async function seedGroup(memberCount = 4, payoutRecipientsCount = 2) {
  const owner = await createUser(PHONES[0], 'Owner');
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `INV-CYCLE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerName: 'Owner Tester',
      phone: owner.phone,
      amountNgwe: 50000n,
      status: 'paid',
      paidAt: new Date(),
    },
  });
  const group = await prisma.group.create({
    data: {
      name: 'Cycle Test Group',
      invoiceId: invoice.id,
      ownerId: owner.id,
      template: GroupTemplate.custom,
    },
  });
  await prisma.groupSetting.create({
    data: {
      groupId: group.id,
      maxMembers: memberCount,
      contributionAmountNgwe: 10000n,
      payoutRecipientsCount,
      contributionFrequency: 'weekly',
      payoutMethod: 'queue',
    },
  });
  const ownerMember = await prisma.groupMember.create({
    data: {
      groupId: group.id,
      userId: owner.id,
      role: GroupMemberRole.owner,
      payoutPosition: 1,
    },
  });
  const members = [ownerMember];
  for (let index = 1; index < memberCount; index += 1) {
    const user = await createUser(PHONES[index], `Member${index}`);
    members.push(
      await prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId: user.id,
          role: GroupMemberRole.member,
          payoutPosition: index + 1,
        },
      }),
    );
  }
  return { group, members, ownerToken: await tokenFor(owner.phone) };
}

describeIf('cycles / contributions / payouts', () => {
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('savings-pool group (0 payout recipients) opens with one round per member and no recipients', async () => {
    const { group, ownerToken } = await seedGroup(4, 0);
    await prisma.groupSetting.update({
      where: { groupId: group.id },
      data: { allowLoans: true },
    });

    const res = await request(app)
      .post(`/api/v1/groups/${group.id}/cycles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe(CycleStatus.open);
    expect(res.body.data.rounds).toHaveLength(4);
    expect(res.body.data.rounds.every((r: { recipients: unknown[] }) => r.recipients.length === 0)).toBe(true);
  });

  it('savings-pool round completes when all contributions are in (no payout step)', async () => {
    const { group, members, ownerToken } = await seedGroup(2, 0);
    await prisma.groupSetting.update({
      where: { groupId: group.id },
      data: { allowLoans: true },
    });

    const opened = await request(app)
      .post(`/api/v1/groups/${group.id}/cycles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    const cycleId = opened.body.data.id as string;
    const roundId = opened.body.data.rounds[0].id as string;

    await request(app)
      .post(`/api/v1/groups/${group.id}/cycles/${cycleId}/start`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    for (const member of members) {
      await request(app)
        .post(
          `/api/v1/groups/${group.id}/cycles/${cycleId}/rounds/${roundId}/contributions/${member.id}/record`,
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});
    }

    const round = await prisma.cycleRound.findUniqueOrThrow({ where: { id: roundId } });
    expect(round.status).toBe(RoundStatus.completed);
  });

  it('owner opens a cycle and queue recipients are generated by payout position', async () => {
    const { group, ownerToken } = await seedGroup(4, 2);

    const res = await request(app)
      .post(`/api/v1/groups/${group.id}/cycles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe(CycleStatus.open);
    expect(res.body.data.rounds).toHaveLength(2);
    expect(res.body.data.rounds[0].recipients).toHaveLength(2);
    expect(res.body.data.rounds[1].recipients).toHaveLength(2);
  });

  it('recording a payout completes the final round and auto-completes the cycle', async () => {
    const { group, members, ownerToken } = await seedGroup(2, 2);
    const opened = await request(app)
      .post(`/api/v1/groups/${group.id}/cycles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    const cycleId = opened.body.data.id as string;
    const roundId = opened.body.data.rounds[0].id as string;

    await request(app)
      .post(`/api/v1/groups/${group.id}/cycles/${cycleId}/start`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    for (const member of members) {
      await prisma.contribution.create({
        data: {
          groupId: group.id,
          cycleId,
          roundId,
          memberId: member.id,
          amountNgwe: 10000n,
          dueDate: new Date(),
          paidDate: new Date(),
          status: ContributionStatus.paid,
        },
      });
    }
    await prisma.cycleRound.update({
      where: { id: roundId },
      data: { totalCollectedNgwe: 20000n, status: RoundStatus.collecting },
    });

    const res = await request(app)
      .post(`/api/v1/groups/${group.id}/cycles/${cycleId}/rounds/${roundId}/payouts/record`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ notes: 'Mobile money paid' });

    expect(res.status).toBe(200);
    expect(String(res.body.data.totalDistributedNgwe)).toBe('20000');

    const round = await prisma.cycleRound.findUniqueOrThrow({ where: { id: roundId } });
    const cycle = await prisma.cycle.findUniqueOrThrow({ where: { id: cycleId } });
    expect(round.status).toBe(RoundStatus.completed);
    expect(cycle.status).toBe(CycleStatus.completed);
  });

  it('manual complete notifies the linked WhatsApp group', async () => {
    const { group, ownerToken } = await seedGroup(2, 1);
    const whatsappJid = '120363000000000001@g.us';
    await prisma.groupSetting.update({
      where: { groupId: group.id },
      data: { whatsappGroupJid: whatsappJid },
    });

    const opened = await request(app)
      .post(`/api/v1/groups/${group.id}/cycles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    const cycleId = opened.body.data.id as string;

    await request(app)
      .post(`/api/v1/groups/${group.id}/cycles/${cycleId}/start`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    const res = await request(app)
      .post(`/api/v1/groups/${group.id}/cycles/${cycleId}/complete`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(CycleStatus.completed);

    const log = await prisma.whatsappLog.findFirst({
      where: { toPhone: whatsappJid, message: { contains: 'Cycle #1 is complete.' } },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).not.toBeNull();
  });

  it('recording a contribution notifies the linked WhatsApp group', async () => {
    const { group, members, ownerToken } = await seedGroup(2, 1);
    const whatsappJid = '120363000000000002@g.us';
    await prisma.groupSetting.update({
      where: { groupId: group.id },
      data: { whatsappGroupJid: whatsappJid },
    });

    const opened = await request(app)
      .post(`/api/v1/groups/${group.id}/cycles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    const cycleId = opened.body.data.id as string;
    const roundId = opened.body.data.rounds[0].id as string;
    const memberId = members[1].id;

    await request(app)
      .post(`/api/v1/groups/${group.id}/cycles/${cycleId}/start`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    const res = await request(app)
      .post(`/api/v1/groups/${group.id}/cycles/${cycleId}/rounds/${roundId}/contributions/${memberId}/record`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(ContributionStatus.paid);

    const log = await prisma.whatsappLog.findFirst({
      where: { toPhone: whatsappJid, message: { contains: 'Payment received from' } },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).not.toBeNull();
  });

  it('owner cannot remove an unpaid member during an in-progress cycle', async () => {
    const { group, members, ownerToken } = await seedGroup(4, 2);
    const opened = await request(app)
      .post(`/api/v1/groups/${group.id}/cycles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    const cycleId = opened.body.data.id as string;
    const unpaidMember = members[2];

    await request(app)
      .post(`/api/v1/groups/${group.id}/cycles/${cycleId}/start`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    const res = await request(app)
      .delete(`/api/v1/groups/${group.id}/members/${unpaidMember.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MEMBER_HAS_ACTIVE_CYCLE');
  });
});
