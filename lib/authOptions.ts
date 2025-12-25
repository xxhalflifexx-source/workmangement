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
        sameSite: "lax", // "lax" allows cookies to be sent on top-level navigations (like redirects)
        path: "/", // Cookie available for all paths
        secure: process.env.NODE_ENV === "production", // HTTPS only in production
        // Don't set domain - let browser handle it automatically
        // This ensures cookie works across subdomains if needed
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
        // Don't set domain - let browser handle it automatically
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // Don't set domain - let browser handle it automatically
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
            isSuperAdmin: true,
            organizationId: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
              },
            },
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
            throw new Error("Your account is pending approval. Please contact management.");
          }
          if (user.status === "REJECTED") {
            throw new Error("Your account has been rejected. Please contact your manager.");
          }
        }

        // Check if user's organization is active (Super Admins bypass this check)
        if (!user.isSuperAdmin && user.organization && !user.organization.isActive) {
          console.log("[auth] organization is disabled");
          throw new Error("Your organization has been disabled. Please contact support.");
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
          isSuperAdmin: user.isSuperAdmin,
          organizationId: user.organizationId,
          organizationName: user.organization?.name ?? null,
          organizationSlug: user.organization?.slug ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        console.log("[Auth] JWT callback - User data added to token");
        console.log("[Auth] - User ID:", (user as any).id);
        console.log("[Auth] - User email:", (user as any).email);
        console.log("[Auth] - User role:", (user as any).role);
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.isSuperAdmin = (user as any).isSuperAdmin;
        token.organizationId = (user as any).organizationId;
        token.organizationName = (user as any).organizationName;
        token.organizationSlug = (user as any).organizationSlug;
      }
      // Refresh token on session update - re-fetch user data from DB
      if (trigger === "update" && token.id) {
        console.log("[Auth] JWT callback - Token update triggered for user:", token.id);
        const freshUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            role: true,
            isSuperAdmin: true,
            organizationId: true,
            organization: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        });
        if (freshUser) {
          token.role = freshUser.role as "EMPLOYEE" | "MANAGER" | "ADMIN";
          token.isSuperAdmin = freshUser.isSuperAdmin;
          token.organizationId = freshUser.organizationId;
          token.organizationName = freshUser.organization?.name ?? null;
          token.organizationSlug = freshUser.organization?.slug ?? null;
        }
      }
      console.log("[Auth] JWT callback - Token returned with ID:", token.id || "None");
      return token;
    },
    async session({ session, token }) {
      console.log("[Auth] Session callback - Creating session");
      console.log("[Auth] - Token ID:", token.id || "None");
      console.log("[Auth] - Token role:", token.role || "None");
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as any;
        (session.user as any).isSuperAdmin = token.isSuperAdmin as boolean;
        (session.user as any).organizationId = token.organizationId as string | null;
        (session.user as any).organizationName = token.organizationName as string | null;
        (session.user as any).organizationSlug = token.organizationSlug as string | null;
        console.log("[Auth] Session callback - Session user data set");
        console.log("[Auth] - Session user ID:", (session.user as any).id);
        console.log("[Auth] - Session user email:", session.user.email);
        console.log("[Auth] - Session user role:", (session.user as any).role);
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

// Log configuration on server startup (without exposing secrets)
if (typeof window === "undefined") {
  console.log("[Auth] NextAuth configuration:");
  console.log("[Auth] - NEXTAUTH_SECRET present:", !!process.env.NEXTAUTH_SECRET);
  console.log("[Auth] - NEXTAUTH_SECRET length:", process.env.NEXTAUTH_SECRET?.length || 0);
  console.log("[Auth] - NEXTAUTH_URL:", process.env.NEXTAUTH_URL || "Not set");
  console.log("[Auth] - NODE_ENV:", process.env.NODE_ENV);
  console.log("[Auth] - Cookie secure flag:", process.env.NODE_ENV === "production");
}
