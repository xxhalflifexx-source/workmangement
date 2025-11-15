import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash("Passw0rd!", 10);
  
  // SQLite doesn't support skipDuplicates, so we use upsert instead
  const users = [
    {
      name: "Alice Admin",
      email: "admin@example.com",
      passwordHash,
      role: "ADMIN",
      isVerified: true,
    },
    {
      name: "Mark Manager",
      email: "manager@example.com",
      passwordHash,
      role: "MANAGER",
      isVerified: true,
    },
    {
      name: "Ed Employee",
      email: "employee@example.com",
      passwordHash,
      role: "EMPLOYEE",
      isVerified: true,
    },
    {
      name: "Tom Admin",
      email: "tom.admin@example.com",
      passwordHash,
      role: "ADMIN",
      isVerified: true,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: user,
      create: user,
    });
  }

  // Users are already created/updated via upsert above, so this is not needed
  
  console.log("✅ Database seeded successfully!");
  console.log("\nTest users created:");
  console.log("  Admin:    admin@example.com / Passw0rd!");
  console.log("  Manager:  manager@example.com / Passw0rd!");
  console.log("  Employee: employee@example.com / Passw0rd!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


