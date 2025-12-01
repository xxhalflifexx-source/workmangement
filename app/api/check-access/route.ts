import { NextRequest, NextResponse } from "next/server";
import { checkUserAccess } from "@/lib/user-access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ hasAccess: false, error: "Not authenticated" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;
  const searchParams = request.nextUrl.searchParams;
  const componentName = searchParams.get("componentName");

  if (!componentName) {
    return NextResponse.json({ hasAccess: false, error: "Component name required" }, { status: 400 });
  }

  try {
    const hasAccess = await checkUserAccess(userId, userRole, componentName);
    return NextResponse.json({ hasAccess });
  } catch (error) {
    console.error("Check access error:", error);
    return NextResponse.json({ hasAccess: false, error: "Failed to check access" }, { status: 500 });
  }
}

