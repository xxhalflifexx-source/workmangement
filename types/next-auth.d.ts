import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "EMPLOYEE" | "MANAGER" | "ADMIN";
      isSuperAdmin: boolean;
      organizationId: string | null;
      organizationName: string | null;
      organizationSlug: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "EMPLOYEE" | "MANAGER" | "ADMIN";
    isSuperAdmin: boolean;
    organizationId: string | null;
    organizationName: string | null;
    organizationSlug: string | null;
  }
}



