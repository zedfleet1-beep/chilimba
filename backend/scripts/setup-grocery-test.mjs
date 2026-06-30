import { PrismaClient, GroupTemplate } from '@prisma/client';

const prisma = new PrismaClient();

const group = await prisma.group.findFirst({
  where: { name: 'Prince Test Chilimba' },
  include: { settings: true, cycles: { where: { status: { in: ['open', 'in_progress'] } } } },
});

if (!group) {
  console.error('Prince Test Chilimba not found — run db:seed first');
  process.exit(1);
}

// End active cycle so we can test opening a fresh savings-pool cycle
for (const cycle of group.cycles) {
  await prisma.cycle.update({
    where: { id: cycle.id },
    data: { status: 'completed', completedAt: new Date() },
  });
}

await prisma.group.update({
  where: { id: group.id },
  data: { template: GroupTemplate.grocery },
});

await prisma.groupSetting.update({
  where: { groupId: group.id },
  data: {
    payoutRecipientsCount: 0,
    allowLoans: true,
    payoutMethod: 'queue',
  },
});

console.log(
  JSON.stringify(
    {
      groupId: group.id,
      name: group.name,
      template: 'grocery',
      payoutRecipientsCount: 0,
      allowLoans: true,
    },
    null,
    2,
  ),
);

await prisma.$disconnect();