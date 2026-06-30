import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const u = await prisma.user.findUnique({ where: { phone: '+260963285865' } });
console.log(JSON.stringify(u, null, 2));
await prisma.$disconnect();