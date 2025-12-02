"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export async function getHandbookContent() {
  try {
    const handbook = await prisma.employeeHandbook.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    return {
      ok: true,
      content: handbook?.content || null,
      lastUpdated: handbook?.updatedAt || null,
    };
  } catch (error: any) {
    console.error("Error loading handbook:", error);
    return {
      ok: false,
      error: error?.message || "Failed to load handbook",
      content: null,
      lastUpdated: null,
    };
  }
}

export async function saveHandbookContent(content: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only admins can save handbook content
  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only admins can edit the handbook" };
  }

  try {
    // Check if handbook exists
    const existing = await prisma.employeeHandbook.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    if (existing) {
      // Update existing handbook
      await prisma.employeeHandbook.update({
        where: { id: existing.id },
        data: {
          content,
          updatedBy: (session.user as any).id,
        },
      });
    } else {
      // Create new handbook
      await prisma.employeeHandbook.create({
        data: {
          content,
          updatedBy: (session.user as any).id,
        },
      });
    }

    return { ok: true };
  } catch (error: any) {
    console.error("Error saving handbook:", error);
    return {
      ok: false,
      error: error?.message || "Failed to save handbook",
    };
  }
}

