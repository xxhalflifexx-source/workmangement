import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Configure Prisma to work with Supabase connection pooler
// The DATABASE_URL should have ?pgbouncer=true to disable prepared statements
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    // Ensure we're using the correct connection settings
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
