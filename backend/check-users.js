const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany();
    console.log('Users in database:');
    users.forEach(u => {
        console.log(`- ${u.email} (Active: ${u.isActive}, Role: ${u.role})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
