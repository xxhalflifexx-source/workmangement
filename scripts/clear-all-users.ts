import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🗑️  Deleting all users from database...");
  
  const result = await prisma.user.deleteMany({});
  
  console.log(`✅ Deleted ${result.count} users successfully!`);
  console.log("\n📝 Database is now empty and ready for fresh testing!");
  console.log("\nYou can now register with the same email addresses again.");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



