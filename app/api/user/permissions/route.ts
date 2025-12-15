import { NextRequest, NextResponse } from "next/server";
import { getSafeServerSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { parsePermissions } from "@/lib/permissions";

// Force dynamic rendering to avoid static optimization errors on Vercel
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const session = await getSafeServerSession(request);

  if (!session?.user) {
    return NextResponse.json({ 
      error: "Not authenticated. Please ensure cookies are enabled." 
    }, { status: 401 });
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

