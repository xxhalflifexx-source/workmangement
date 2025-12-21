import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { compare } from "bcryptjs";
import { z } from "zod";
import type { NextAuthOptions } from "next-auth";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { 
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours - update session once per day
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (creds) => {
        console.log("[auth] authorize called");
        const parsed = credentialsSchema.safeParse(creds);
        if (!parsed.success) {
          console.log("[auth] invalid schema");
          return null;
        }
        
        const { email, password } = parsed.data;
        // Make email case-insensitive for lookup
        const emailLower = email.toLowerCase().trim();
        console.log("[auth] lookup user (case-insensitive):", emailLower);
        
        // Find user with case-insensitive email comparison
        // Fetch all users and filter case-insensitively (for small user bases this is fine)
        // Alternative: Use Prisma.sql for raw query if needed
        const allUsers = await prisma.user.findMany({
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            isVerified: true,
            status: true,
            role: true,
          },
        });
        
        // Find exact match (case-insensitive)
        const user = allUsers.find(u => u.email && u.email.toLowerCase() === emailLower) || null;
        
        // Always return same error message for security (don't reveal if email exists)
        if (!user || !user.passwordHash) {
          console.log("[auth] no user or no hash");
          throw new Error("Wrong username/password");
        }
        
        // Check if email is verified
        if (!user.isVerified) {
          console.log("[auth] not verified");
          throw new Error("Please verify your email before logging in");
        }
        
        // Check approval status (treat missing status as APPROVED to avoid locking old accounts)
        if (user.status && user.status !== "APPROVED") {
          console.log("[auth] user not approved, status:", user.status);
          if (user.status === "PENDING") {
            throw new Error("Your account is waiting for approval from a manager or admin.");
          }
          if (user.status === "REJECTED") {
            throw new Error("Your account has been rejected. Please contact your manager.");
          }
        }
        
        const isValid = await compare(password, user.passwordHash);
        console.log("[auth] compare result:", isValid);
        if (!isValid) {
          console.log("[auth] invalid password");
          throw new Error("Wrong username/password");
        }
        
        return {
          id: user.id,
          name: user.name ?? "",
          email: user.email ?? "",
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      // Refresh token on session update
      if (trigger === "update") {
        // Token will be refreshed
        return { ...token };
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as any;
      }
      return session;
    },
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days - same as session maxAge
  },
  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
