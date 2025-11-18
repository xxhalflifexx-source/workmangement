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
  session: { strategy: "jwt" },
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
        console.log("[auth] lookup user:", email);
        const user = await prisma.user.findUnique({ where: { email } });
        
        if (!user || !user.passwordHash) {
          console.log("[auth] no user or no hash");
          return null;
        }
        
        // Check if email is verified
        if (!user.isVerified) {
          console.log("[auth] not verified");
          throw new Error("Please verify your email before logging in");
        }
        
        const isValid = await compare(password, user.passwordHash);
        console.log("[auth] compare result:", isValid);
        if (!isValid) {
          console.log("[auth] invalid password");
          return null;
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
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
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
  pages: {
    signIn: "/login",
    signOut: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
