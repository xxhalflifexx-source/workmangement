import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: ['admin@example.com', 'employee@example.com', 'manager@example.com']
      }
    },
    select: {
      email: true,
      role: true,
      isVerified: true,
      status: true,
    }
  });
  
  console.log('Test users in database:');
  console.log(JSON.stringify(users, null, 2));
  
  if (users.length === 0) {
    console.log('\n⚠️  No test users found! Run: npx prisma db seed');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

