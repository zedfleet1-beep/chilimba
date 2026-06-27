import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const phones = ['+260963285865', '+260770172220'];

const users = await prisma.user.findMany({
  where: { phone: { in: phones } },
  select: { id: true, phone: true, firstName: true, otpVerified: true, status: true, passwordHash: true },
});

for (const u of users) {
  const ok = await bcrypt.compare('P@ssw0rd!1', u.passwordHash);
  console.log({ phone: u.phone, firstName: u.firstName, otpVerified: u.otpVerified, passwordMatch: ok });
}

await prisma.$disconnect();