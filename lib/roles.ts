import { getServerSession } from "next-auth";
import { authOptions } from "./authOptions";

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function assertRole(minRole: "MANAGER" | "ADMIN") {
  const { user } = await requireAuth();
  
  const rank = (r: string) => (r === "ADMIN" ? 3 : r === "MANAGER" ? 2 : 1);
  
  if (rank(user.role) < rank(minRole)) {
    throw new Error("FORBIDDEN");
  }
  
  return true;
}



