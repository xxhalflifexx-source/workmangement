"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

interface RegisterPushRequest {
  token: string;
  platform: 'ios' | 'android';
  deviceId?: string;
}

/**
 * Register device for push notifications
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body: RegisterPushRequest = await request.json();
    const { token, platform, deviceId } = body;

    if (!token || !platform) {
      return Response.json({ error: "Token and platform are required" }, { status: 400 });
    }

    // Store push token in database
    await prisma.pushToken.upsert({
      where: { token },
      update: {
        platform,
        deviceId,
        updatedAt: new Date(),
      },
      create: {
        token,
        platform,
        deviceId,
        userId: session.user.id,
      },
    });
    
    return Response.json({ 
      success: true,
      message: "Push token registered successfully" 
    });
  } catch (error: any) {
    console.error("[Push] Failed to register push token:", error);
    return Response.json(
      { error: error?.message || "Failed to register push token" },
      { status: 500 }
    );
  }
}

