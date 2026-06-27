"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Seed: creates a super_admin test user for development.
 * Run with: npm run db:seed
 */
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    const phone = '+260970000000';
    const password = process.env.SEED_SUPER_ADMIN_PASSWORD || 'ChangeMe!2026';
    const passwordHash = await bcryptjs_1.default.hash(password, 12);
    const user = await prisma.user.upsert({
        where: { phone },
        update: {},
        create: {
            firstName: 'Super',
            lastName: 'Admin',
            phone,
            email: 'admin@chilimba.local',
            passwordHash,
            otpVerified: true,
            role: client_1.UserRole.super_admin,
            status: client_1.UserStatus.active,
        },
    });
    // eslint-disable-next-line no-console
    console.log(`✅ Seeded super_admin user:`);
    // eslint-disable-next-line no-console
    console.log(`   phone:    ${user.phone}`);
    // eslint-disable-next-line no-console
    console.log(`   password: ${password}`);
    // eslint-disable-next-line no-console
    console.log(`   role:     ${user.role}`);
}
main()
    .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map