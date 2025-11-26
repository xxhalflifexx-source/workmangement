"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export async function getNotifications() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const userId = (session.user as any).id;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50, // Limit to 50 most recent
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    // Convert Date objects to ISO strings for JSON serialization
    const serializedNotifications = notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt ? n.readAt.toISOString() : null,
    }));

    return {
      ok: true,
      notifications: serializedNotifications,
      unreadCount,
    };
  } catch (error: any) {
    console.error("Get notifications error:", error);
    return { ok: false, error: error?.message || "Failed to fetch notifications" };
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const userId = (session.user as any).id;

    // Verify notification belongs to user
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { userId: true },
    });

    if (!notification || notification.userId !== userId) {
      return { ok: false, error: "Notification not found or unauthorized" };
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { ok: true };
  } catch (error: any) {
    console.error("Mark notification as read error:", error);
    return { ok: false, error: error?.message || "Failed to mark notification as read" };
  }
}

export async function markAllNotificationsAsRead() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const userId = (session.user as any).id;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { ok: true };
  } catch (error: any) {
    console.error("Mark all notifications as read error:", error);
    return { ok: false, error: error?.message || "Failed to mark all notifications as read" };
  }
}

// Helper function to create notifications (can be called from other parts of the app)
export async function createNotification(
  userId: string,
  title: string,
  message?: string,
  type: string = "INFO",
  linkUrl?: string
) {
  try {
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        linkUrl,
      },
    });

    return { ok: true };
  } catch (error: any) {
    console.error("Create notification error:", error);
    return { ok: false, error: error?.message || "Failed to create notification" };
  }
}

