const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany();
    console.log('--- User Verification ---');
    for (const u of users) {
        const isMatched = await bcrypt.compare('password123', u.password);
        console.log(`- ${u.email} | Role: ${u.role} | Active: ${u.isActive} | Pwd Match: ${isMatched}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
