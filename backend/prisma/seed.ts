/**
 * Seed: super admin, plus two demo customers that exercise the full
 * Week 3-4 flow.
 *
 *   1. Super admin         — phone +260970000000
 *   2. Mary Banda          — paid invoice, active group with 5 members
 *   3. Peter Mumba         — pending invoice, 1 pending POP for review
 *
 * Idempotent: every user is upserted by phone. Re-running the seed
 * leaves the database in the same state.
 *
 * Run with: npm run db:seed
 */
import {
  PrismaClient,
  GroupTemplate,
  GroupMemberRole,
  InvoiceStatus,
  PaymentProofStatus,
  UserRole,
  UserStatus,
  CycleStatus,
  RoundStatus,
  ContributionStatus,
  LoanStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_PHONE = '+260970000000';
const MARY_PHONE = '+260971000001';
const PETER_PHONE = '+260972000001';
/** Real test numbers provided for WhatsApp / login smoke tests. */
const TEST_OWNER_PHONE = '+260963285865'; // 0963285865
const TEST_MEMBER_PHONE = '+260770172220'; // 0770172220
const MARY_PASSWORD = 'P@ssw0rd!1';
const PETER_PASSWORD = 'P@ssw0rd!1';
const TEST_PASSWORD = 'sTBvg7U2YQLEdpJ';
const ADMIN_PASSWORD_DEFAULT = 'ChangeMe!2026';

const MEMBER_NAMES = [
  { firstName: 'Mary', lastName: 'Banda', role: GroupMemberRole.owner, phone: MARY_PHONE },
  { firstName: 'Grace', lastName: 'Mwape', role: GroupMemberRole.treasurer, phone: '+260971000010' },
  { firstName: 'Thandi', lastName: 'Phiri', role: GroupMemberRole.member, phone: '+260971000011' },
  { firstName: 'Bwalya', lastName: 'Mutale', role: GroupMemberRole.member, phone: '+260971000012' },
  { firstName: 'Mutinta', lastName: 'Sichone', role: GroupMemberRole.member, phone: '+260971000013' },
];

async function ensureUser(phone: string, firstName: string, lastName: string, password: string, role: UserRole) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { phone },
    update: { firstName, lastName, role, passwordHash, otpVerified: true, status: UserStatus.active },
    create: {
      firstName,
      lastName,
      phone,
      passwordHash,
      otpVerified: true,
      role,
      status: UserStatus.active,
    },
  });
}

async function main() {
  const adminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD || ADMIN_PASSWORD_DEFAULT;

  // ---------------------------------------------------------------------------
  // 1. Super admin
  // ---------------------------------------------------------------------------
  const admin = await ensureUser(ADMIN_PHONE, 'Super', 'Admin', adminPassword, UserRole.super_admin);

  // ---------------------------------------------------------------------------
  // 2. Mary + paid invoice + active group with 5 members
  // ---------------------------------------------------------------------------
  const memberUsers = await Promise.all(
    MEMBER_NAMES.map((m) => ensureUser(m.phone, m.firstName, m.lastName, MARY_PASSWORD, UserRole.member)),
  );
  const memberByPhone = new Map(memberUsers.map((u) => [u.phone, u]));

  // Paid invoice (skip if a group already exists for it)
  const existingInvoice = await prisma.invoice.findUnique({ where: { invoiceNumber: 'INV0001' } });
  let invoiceForMary = existingInvoice;
  if (!invoiceForMary) {
    invoiceForMary = await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV0001',
        customerName: 'Mary Banda',
        phone: MARY_PHONE,
        amountNgwe: 50000n,
        description: 'Chilimba group plan — monthly',
        status: InvoiceStatus.paid,
        paidAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        createdById: admin.id,
      },
    });
  }

  // Group + settings + members — idempotent
  let maryGroup = await prisma.group.findUnique({ where: { invoiceId: invoiceForMary.id } });
  if (!maryGroup) {
    maryGroup = await prisma.group.create({
      data: {
        name: "Lusaka Women's Chilimba 2026",
        description: 'Monthly savings for our 12-person group.',
        invoiceId: invoiceForMary.id,
        ownerId: memberByPhone.get(MARY_PHONE)!.id,
        template: GroupTemplate.rotating_cash,
        country: 'ZM',
        currency: 'ZMW',
      },
    });
    await prisma.groupSetting.create({
      data: {
        groupId: maryGroup.id,
        maxMembers: 20,
        contributionAmountNgwe: 100000n,
        contributionFrequency: 'monthly',
        gracePeriodDays: 5,
        payoutRecipientsCount: 2,
        payoutMethod: 'queue',
        allowLoans: true,
      },
    });
    let position = 1;
    for (const m of MEMBER_NAMES) {
      const u = memberByPhone.get(m.phone)!;
      await prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: maryGroup.id, userId: u.id } },
        update: { role: m.role, payoutPosition: position, status: 'active' },
        create: {
          groupId: maryGroup.id,
          userId: u.id,
          role: m.role,
          payoutPosition: position,
          status: 'active',
        },
      });
      position++;
    }
  }

  if (maryGroup) {
    await prisma.groupSetting.updateMany({
      where: { groupId: maryGroup.id },
      data: { allowLoans: true },
    });
  }

  // ---------------------------------------------------------------------------
  // 2b. Mary's group — demo in-progress cycle (Week 5-6 vertical slice)
  // ---------------------------------------------------------------------------
  if (maryGroup) {
    const existingCycle = await prisma.cycle.findFirst({ where: { groupId: maryGroup.id } });
    if (!existingCycle) {
      const members = await prisma.groupMember.findMany({
        where: { groupId: maryGroup.id, status: 'active' },
        orderBy: { payoutPosition: 'asc' },
      });
      const settings = await prisma.groupSetting.findUniqueOrThrow({ where: { groupId: maryGroup.id } });
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const cycle = await prisma.cycle.create({
        data: {
          groupId: maryGroup.id,
          cycleNumber: 1,
          status: CycleStatus.in_progress,
          startedAt: new Date(),
        },
      });

      const round1 = await prisma.cycleRound.create({
        data: {
          cycleId: cycle.id,
          roundNumber: 1,
          dueDate,
          status: RoundStatus.collecting,
          totalCollectedNgwe: settings.contributionAmountNgwe * 2n,
        },
      });
      await prisma.cycleRound.create({
        data: {
          cycleId: cycle.id,
          roundNumber: 2,
          dueDate: new Date(dueDate.getTime() + 30 * 24 * 60 * 60 * 1000),
          status: RoundStatus.pending,
          totalCollectedNgwe: 0n,
        },
      });
      await prisma.cycleRound.create({
        data: {
          cycleId: cycle.id,
          roundNumber: 3,
          dueDate: new Date(dueDate.getTime() + 60 * 24 * 60 * 60 * 1000),
          status: RoundStatus.pending,
          totalCollectedNgwe: 0n,
        },
      });

      const recipients = members.slice(0, settings.payoutRecipientsCount);
      for (const member of recipients) {
        await prisma.cyclePayout.create({
          data: {
            roundId: round1.id,
            memberId: member.id,
            amountNgwe: settings.contributionAmountNgwe * BigInt(members.length),
          },
        });
      }

      const paidMembers = members.slice(0, 2);
      for (const member of paidMembers) {
        await prisma.contribution.create({
          data: {
            groupId: maryGroup.id,
            cycleId: cycle.id,
            roundId: round1.id,
            memberId: member.id,
            amountNgwe: settings.contributionAmountNgwe,
            dueDate,
            paidDate: new Date(),
            status: ContributionStatus.paid,
          },
        });
      }
    }

    const thandi = await prisma.groupMember.findFirst({
      where: {
        groupId: maryGroup.id,
        user: { phone: '+260971000011' },
      },
    });
    const existingLoan = thandi
      ? await prisma.loan.findFirst({ where: { groupId: maryGroup.id, memberId: thandi.id } })
      : null;
    if (thandi && !existingLoan) {
      const settings = await prisma.groupSetting.findUniqueOrThrow({ where: { groupId: maryGroup.id } });
      const amountNgwe = 200000n;
      const interest = BigInt(Math.round(Number(amountNgwe) * Number(settings.loanInterestRate)));
      await prisma.loan.create({
        data: {
          groupId: maryGroup.id,
          memberId: thandi.id,
          amountNgwe,
          interestRate: settings.loanInterestRate,
          totalDueNgwe: amountNgwe + interest,
          purpose: 'School fees',
          status: LoanStatus.pending,
          dueDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 2c. Real-number test group — 0963285865 (owner) + 0770172220 (treasurer)
  // ---------------------------------------------------------------------------
  const testOwner = await ensureUser(TEST_OWNER_PHONE, 'Prince', 'Owner', TEST_PASSWORD, UserRole.member);
  const testTreasurer = await ensureUser(TEST_MEMBER_PHONE, 'Test', 'Treasurer', TEST_PASSWORD, UserRole.member);

  let testInvoice = await prisma.invoice.findUnique({ where: { invoiceNumber: 'INV0003' } });
  if (!testInvoice) {
    testInvoice = await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV0003',
        customerName: 'Prince Owner',
        phone: TEST_OWNER_PHONE,
        amountNgwe: 50000n,
        description: 'Chilimba test group',
        status: InvoiceStatus.paid,
        paidAt: new Date(),
        createdById: admin.id,
      },
    });
  }

  let testGroup = await prisma.group.findUnique({ where: { invoiceId: testInvoice.id } });
  if (!testGroup) {
    testGroup = await prisma.group.create({
      data: {
        name: 'Prince Test Chilimba',
        description: 'Smoke-test group for cycles, contributions, reports, and loans.',
        invoiceId: testInvoice.id,
        ownerId: testOwner.id,
        template: GroupTemplate.custom,
      },
    });
    await prisma.groupSetting.create({
      data: {
        groupId: testGroup.id,
        maxMembers: 10,
        contributionAmountNgwe: 50000n,
        contributionFrequency: 'monthly',
        gracePeriodDays: 3,
        payoutRecipientsCount: 1,
        payoutMethod: 'queue',
        allowLoans: true,
      },
    });
    await prisma.groupMember.create({
      data: {
        groupId: testGroup.id,
        userId: testOwner.id,
        role: GroupMemberRole.owner,
        payoutPosition: 1,
      },
    });
    await prisma.groupMember.create({
      data: {
        groupId: testGroup.id,
        userId: testTreasurer.id,
        role: GroupMemberRole.treasurer,
        payoutPosition: 2,
      },
    });

    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const cycle = await prisma.cycle.create({
      data: {
        groupId: testGroup.id,
        cycleNumber: 1,
        status: CycleStatus.in_progress,
        startedAt: new Date(),
      },
    });
    const round = await prisma.cycleRound.create({
      data: {
        cycleId: cycle.id,
        roundNumber: 1,
        dueDate,
        status: RoundStatus.collecting,
        totalCollectedNgwe: 0n,
      },
    });
    const ownerMember = await prisma.groupMember.findUniqueOrThrow({
      where: { groupId_userId: { groupId: testGroup.id, userId: testOwner.id } },
    });
    await prisma.cyclePayout.create({
      data: { roundId: round.id, memberId: ownerMember.id, amountNgwe: 100000n },
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Peter + pending invoice + 1 pending POP for the admin to review
  // ---------------------------------------------------------------------------
  await ensureUser(PETER_PHONE, 'Peter', 'Mumba', PETER_PASSWORD, UserRole.member);
  const peter = await prisma.user.findUniqueOrThrow({ where: { phone: PETER_PHONE } });

  const existingPeterInvoice = await prisma.invoice.findUnique({ where: { invoiceNumber: 'INV0002' } });
  let invoiceForPeter = existingPeterInvoice;
  if (!invoiceForPeter) {
    invoiceForPeter = await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV0002',
        customerName: 'Peter Mumba',
        phone: PETER_PHONE,
        amountNgwe: 50000n,
        description: 'Chilimba group plan — monthly',
        status: InvoiceStatus.pending,
        createdById: admin.id,
      },
    });
  }

  // Only create the POP if there isn't already one for this invoice.
  // We use a real public Cloudinary URL as the seeded `fileUrl` so the
  // admin can preview something meaningful on /admin/invoices/<id>.
  // The `fileKey` here is a public_id-shaped placeholder — the asset
  // pointed to is the Cloudinary demo sample. Override with a real
  // upload before going to production.
  const SEED_POP_URL =
    'https://res.cloudinary.com/demo/image/upload/sample.pdf';
  const existingPop = await prisma.paymentProof.findFirst({
    where: { invoiceId: invoiceForPeter.id },
  });
  if (!existingPop) {
    await prisma.paymentProof.create({
      data: {
        invoiceId: invoiceForPeter.id,
        uploadedById: peter.id,
        fileKey: 'chilimba/payment_proofs/sample',
        fileUrl: SEED_POP_URL,
        resourceType: 'raw',
        fileType: 'pdf',
        status: PaymentProofStatus.pending,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Platform default payment setting (placeholder)
  //    Idempotent — at most one row where invoiceId IS NULL.
  // ---------------------------------------------------------------------------
  const platformDefault = await prisma.paymentSetting.findFirst({
    where: { invoiceId: null },
  });
  if (!platformDefault) {
    await prisma.paymentSetting.create({
      data: {
        paymentMethod: 'mobile_money',
        mobileMoneyProvider: 'mtn',
        accountName: 'Chilimba Enterprises',
        accountNumber: '+260970000000',
        reference: 'Use your invoice number as the reference',
        createdById: admin.id,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Done. Print credentials so the developer can log in.
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line no-console
  console.log('\n✅ Seed complete. Demo credentials:\n');
  // eslint-disable-next-line no-console
  console.log(`   super_admin  phone ${ADMIN_PHONE}  password ${adminPassword}`);
  // eslint-disable-next-line no-console
  console.log(`   mary (owner) phone ${MARY_PHONE}  password ${MARY_PASSWORD}`);
  // eslint-disable-next-line no-console
  console.log(`   peter        phone ${PETER_PHONE}  password ${PETER_PASSWORD}`);
  // eslint-disable-next-line no-console
  console.log(`   test owner   phone ${TEST_OWNER_PHONE}  password ${TEST_PASSWORD}  (0963285865)`);
  // eslint-disable-next-line no-console
  console.log(`   test treas.  phone ${TEST_MEMBER_PHONE}  password ${TEST_PASSWORD}  (0770172220)`);
  // eslint-disable-next-line no-console
  console.log(`\n   Mary's group "${maryGroup?.name ?? 'Lusaka Women\'s Chilimba 2026'}" has ${MEMBER_NAMES.length} members.`);
  // eslint-disable-next-line no-console
  console.log(`   Test group "${testGroup?.name ?? 'Prince Test Chilimba'}" — login as owner to run cycles/reports/loans.`);
  // eslint-disable-next-line no-console
  console.log(`   Peter's invoice ${invoiceForPeter.invoiceNumber} has 1 pending POP for review.`);
  // eslint-disable-next-line no-console
  console.log(`   Platform default payment setting: MTN Mobile Money, +260970000000.\n`);
}

main()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .catch((e: any) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
