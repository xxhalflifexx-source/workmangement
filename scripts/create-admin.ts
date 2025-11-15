import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

async function main() {
  const [, , nameArg, emailArg, passwordArg, roleArg] = process.argv;

  if (!nameArg || !emailArg || !passwordArg) {
    console.error("Usage: tsx scripts/create-admin.ts <name> <email> <password> [role=ADMIN]");
    process.exit(1);
  }

  const name = nameArg;
  const email = emailArg.toLowerCase();
  const password = passwordArg;
  const role = (roleArg || "ADMIN").toUpperCase();

  const prisma = new PrismaClient();
  try {
    const passwordHash = await hash(password, 10);

    // Upsert user to ensure existence and correct flags
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        passwordHash,
        role,
        isVerified: true,
        verificationCode: null,
        codeExpiresAt: null,
      },
      create: {
        name,
        email,
        passwordHash,
        role,
        isVerified: true,
      },
    });

    console.log("✅ Admin ensured:", { id: user.id, email: user.email, role: user.role, isVerified: user.isVerified });
  } catch (err) {
    console.error("❌ Failed to create/update admin:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();


