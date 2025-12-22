/**
 * Create Super Admin Script
 * 
 * Promotes an existing user to Super Admin or creates a new Super Admin user.
 * 
 * Usage:
 *   npx tsx scripts/create-super-admin.ts <email>
 *   npx tsx scripts/create-super-admin.ts <email> <password>
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email) {
    console.log("Usage: npx tsx scripts/create-super-admin.ts <email> [password]");
    console.log("\nExamples:");
    console.log("  Promote existing user: npx tsx scripts/create-super-admin.ts admin@example.com");
    console.log("  Create new user: npx tsx scripts/create-super-admin.ts admin@example.com MyPassword123");
    process.exit(1);
  }

  console.log(`\n🔍 Looking for user with email: ${email}`);

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    // Promote existing user
    if (existingUser.isSuperAdmin) {
      console.log("⚠️  This user is already a Super Admin.");
      return;
    }

    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        isSuperAdmin: true,
        role: "ADMIN",
        organizationId: null, // Super Admin is not tied to an org
      },
    });

    console.log(`✅ Successfully promoted ${email} to Super Admin!`);
    console.log("\nThis user now has:");
    console.log("  - Access to all organizations");
    console.log("  - Ability to create/manage organizations");
    console.log("  - Ability to manage users across all organizations");
  } else {
    // Create new user
    if (!password) {
      console.log("❌ User not found. To create a new Super Admin, provide a password:");
      console.log(`   npx tsx scripts/create-super-admin.ts ${email} <password>`);
      process.exit(1);
    }

    const passwordHash = await hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        name: "Super Admin",
        passwordHash,
        role: "ADMIN",
        isSuperAdmin: true,
        isVerified: true,
        status: "APPROVED",
        organizationId: null,
      },
    });

    console.log(`✅ Successfully created Super Admin: ${email}`);
    console.log("\nThis user has:");
    console.log("  - Access to all organizations");
    console.log("  - Ability to create/manage organizations");
    console.log("  - Ability to manage users across all organizations");
  }
}

main()
  .catch((e) => {
    console.error("❌ Error:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

