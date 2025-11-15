import { PrismaClient } from "@prisma/client";
import { compare } from "bcryptjs";

async function main() {
  const [, , emailArg, passwordArg] = process.argv;
  if (!emailArg || !passwordArg) {
    console.error("Usage: tsx scripts/check-password.ts <email> <password>");
    process.exit(1);
  }
  const email = emailArg.toLowerCase();
  const password = passwordArg;

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log("User not found");
      return;
    }
    console.log("User:", { email: user.email, isVerified: user.isVerified, role: user.role, hasHash: !!user.passwordHash });
    if (!user.passwordHash) {
      console.log("No passwordHash stored.");
      return;
    }
    const ok = await compare(password, user.passwordHash);
    console.log("compare:", ok);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();


