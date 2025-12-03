import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { parsePermissions } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { permissions: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const permissions = parsePermissions(user.permissions);

    return NextResponse.json({
      permissions,
      role: user.role,
    });
  } catch (error: any) {
    console.error("Error getting user permissions:", error);
    return NextResponse.json(
      { error: "Failed to get permissions" },
      { status: 500 }
    );
  }
}

