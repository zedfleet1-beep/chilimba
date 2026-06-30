import { PrismaClient, UserRole } from '@prisma/client';
const prisma = new PrismaClient();
const u = await prisma.user.update({
  where: { phone: '+260963285865' },
  data: { role: UserRole.super_admin },
});
console.log(`Promoted ${u.firstName} to ${u.role}`);
await prisma.$disconnect();