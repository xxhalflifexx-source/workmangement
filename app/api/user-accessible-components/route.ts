import { NextRequest, NextResponse } from "next/server";
import { getUserAccessibleComponents } from "@/lib/user-access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ components: [], error: "Not authenticated" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;
  const searchParams = request.nextUrl.searchParams;
  const requestedUserId = searchParams.get("userId");

  // Users can only check their own accessible components
  if (requestedUserId && requestedUserId !== userId && userRole !== "ADMIN") {
    return NextResponse.json({ components: [], error: "Unauthorized" }, { status: 403 });
  }

  const targetUserId = requestedUserId || userId;

  try {
    const components = await getUserAccessibleComponents(targetUserId, userRole);
    return NextResponse.json({ components });
  } catch (error) {
    console.error("Get accessible components error:", error);
    return NextResponse.json({ components: [], error: "Failed to get accessible components" }, { status: 500 });
  }
}

