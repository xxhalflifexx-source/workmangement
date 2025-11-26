"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { compare, hash } from "bcryptjs";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
}).refine((data) => {
  // At least one letter and one number
  const hasLetter = /[a-zA-Z]/.test(data.newPassword);
  const hasNumber = /[0-9]/.test(data.newPassword);
  return hasLetter && hasNumber;
}, {
  message: "Password must contain at least one letter and one number",
  path: ["newPassword"],
});

export async function changePassword(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { ok: false, error: "Not authenticated" };
    }

    const userId = (session.user as any).id;
    const data = Object.fromEntries(formData.entries());
    
    const parsed = changePasswordSchema.safeParse(data);
    
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return { ok: false, error: firstError?.message || "Invalid input" };
    }

    const { currentPassword, newPassword } = parsed.data;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      return { ok: false, error: "User not found or no password set" };
    }

    // Verify current password
    const isCurrentPasswordValid = await compare(currentPassword, user.passwordHash);
    
    if (!isCurrentPasswordValid) {
      return { ok: false, error: "Current password is incorrect" };
    }

    // Check if new password is the same as current password
    const isSamePassword = await compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      return { ok: false, error: "New password must be different from current password" };
    }

    // Hash new password
    const newPasswordHash = await hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    return { ok: true, message: "Password changed successfully" };
  } catch (error: any) {
    console.error("Change password error:", error);
    return { ok: false, error: error?.message || "Failed to change password. Please try again." };
  }
}

