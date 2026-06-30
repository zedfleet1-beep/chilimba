import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const groups = await prisma.group.findMany({
  include: { settings: true, members: { where: { status: 'active' } } },
  orderBy: { createdAt: 'desc' },
  take: 20,
});
console.log(
  JSON.stringify(
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      template: g.template,
      payoutRecipients: g.settings?.payoutRecipientsCount,
      allowLoans: g.settings?.allowLoans,
      members: g.members.length,
    })),
    null,
    2,
  ),
);
await prisma.$disconnect();