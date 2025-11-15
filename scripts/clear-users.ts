import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function clearAllUsers() {
  try {
    console.log("🗑️  Clearing all user accounts...\n");

    // Delete all users (this will cascade delete related records)
    const result = await prisma.user.deleteMany({});

    console.log(`✅ Successfully deleted ${result.count} user account(s)!`);
    console.log("\n📝 You can now register new accounts at:");
    console.log("   http://localhost:3000/register");
    console.log("\n💡 Remember the registration codes:");
    console.log("   - 'sunrise' = EMPLOYEE");
    console.log("   - 'sunset' = MANAGER");
    console.log("   - 'moonlight' = ADMIN");
    console.log("   - (leave empty for EMPLOYEE)\n");
  } catch (error) {
    console.error("❌ Error clearing users:", error);
  } finally {
    await prisma.$disconnect();
  }
}

clearAllUsers();



