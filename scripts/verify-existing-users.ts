import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Update all existing users to be verified
  const result = await prisma.user.updateMany({
    where: {
      isVerified: false,
    },
    data: {
      isVerified: true,
      verificationCode: null,
      codeExpiresAt: null,
    },
  });

  console.log(`✅ Updated ${result.count} users to verified status`);
  console.log("\nAll existing test accounts can now log in!");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



