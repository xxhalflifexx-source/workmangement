"use server";

import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";
import { generateVerificationCode, sendVerificationEmail, generateResetToken, sendPasswordResetEmail } from "@/lib/email";
import { parseDateOnly } from "@/lib/date-utils";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
  gender: z.enum(["Male", "Female", "Others"]),
  birthDate: z.string().min(1),
  registrationCode: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

// Registration codes for role assignment
const ROLE_CODES = {
  sunrise: "EMPLOYEE",
  sunset: "MANAGER",
  moonlight: "ADMIN",
} as const;

export async function registerUser(formData: FormData) {
  try {
    const data = Object.fromEntries(formData.entries());
    const parsed = schema.safeParse(data);
    
    if (!parsed.success) {
      return { ok: false, error: "Invalid input" };
    }
    
    const { name, email, password, gender, birthDate, registrationCode } = parsed.data;
    // confirmPassword is validated but not needed after validation
    
    // Parse birthDate string to Date object (date-only, no timezone shift)
    const birthDateObj = birthDate ? parseDateOnly(birthDate) : null;
    
    const exists = await prisma.user.findUnique({ where: { email } });
    
    // If user exists but is NOT verified, delete the old account and allow re-registration
    if (exists) {
      if (!exists.isVerified) {
        console.log(`🔄 Deleting unverified account for ${email} to allow re-registration`);
        await prisma.user.delete({ where: { email } });
      } else {
        return { ok: false, error: "Email already registered and verified. Please login instead." };
      }
    }
    
    // Determine role based on registration code
    let role = "EMPLOYEE"; // Default role
    if (registrationCode) {
      const code = registrationCode.toLowerCase().trim();
      if (code in ROLE_CODES) {
        role = ROLE_CODES[code as keyof typeof ROLE_CODES];
      }
    }
    
    const passwordHash = await hash(password, 10);
    
    // Generate 6-digit verification code
    const verificationCode = generateVerificationCode();
    const codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    // Create user (not verified yet, and pending admin approval)
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        gender,
        birthDate: birthDateObj,
        isVerified: false,
        verificationCode,
        codeExpiresAt,
        status: "PENDING",
      },
    });
    
    // If we're in temporary dev/production recovery mode, auto-verify to keep the site usable
    const autoVerify =
      process.env.DEV_AUTO_VERIFY === "true" ||
      !process.env.RESEND_API_KEY ||
      process.env.RESEND_API_KEY.toLowerCase().includes("placeholder");

    if (autoVerify) {
      await prisma.user.update({
        where: { email },
        data: {
          isVerified: true,
          verificationCode: null,
          codeExpiresAt: null,
          // Auto-verified users created in this mode are considered approved
          status: "APPROVED",
        },
      });
      return { ok: true, email, autoVerified: true };
    }

    // Otherwise, attempt to send the verification email (non-fatal if it fails)
    try {
      const emailResult = await sendVerificationEmail(email, name, verificationCode, role);
      if (!emailResult.success) {
        console.error("Failed to send verification email:", emailResult.error);
      }
    } catch (err) {
      console.error("Email send threw:", err);
    }
    return { ok: true, email, autoVerified: false };
  } catch (error) {
    console.error("Register error:", error);
    // Log more details for debugging
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    // Check for Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      console.error("Prisma error code:", (error as any).code);
    }
    return { ok: false, error: "Registration failed. Please try again." };
  }
}

export async function verifyEmail(formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const parsed = verifySchema.safeParse(data);
  
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }
  
  const { email, code } = parsed.data;
  
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    return { ok: false, error: "User not found" };
  }
  
  if (user.isVerified) {
    return { ok: false, error: "Email already verified" };
  }
  
  if (!user.verificationCode || !user.codeExpiresAt) {
    return { ok: false, error: "No verification code found" };
  }
  
  // Check if code is expired
  if (new Date() > user.codeExpiresAt) {
    return { ok: false, error: "Verification code expired" };
  }
  
  // Check if code matches
  if (user.verificationCode !== code) {
    return { ok: false, error: "Invalid verification code" };
  }
  
  // Verify the user
  await prisma.user.update({
    where: { email },
    data: {
      isVerified: true,
      verificationCode: null,
      codeExpiresAt: null,
      // Keep them pending until admin/manager approves
      status: "PENDING",
    },
  });
  
  return { ok: true };
}

export async function resendVerificationCode(email: string) {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return { ok: false, error: "User not found" };
    }
    
    if (user.isVerified) {
      return { ok: false, error: "Email already verified" };
    }
    
    // Generate new code
    const verificationCode = generateVerificationCode();
    const codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    // Update user with new code
    await prisma.user.update({
      where: { email },
      data: {
        verificationCode,
        codeExpiresAt,
      },
    });
    
    // Send new verification email
    const emailResult = await sendVerificationEmail(
      email,
      user.name || "User",
      verificationCode,
      user.role
    );
    
    if (!emailResult.success) {
      console.error("Failed to resend verification email:", emailResult.error);
      return { ok: false, error: "Failed to send email. Please try again." };
    }
    
    return { ok: true };
  } catch (error) {
    console.error("Resend code error:", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export async function requestPasswordReset(formData: FormData) {
  try {
    const data = Object.fromEntries(formData.entries());
    const parsed = forgotPasswordSchema.safeParse(data);
    
    if (!parsed.success) {
      return { ok: false, error: "Invalid email address" };
    }
    
    const { email } = parsed.data;
    
    const user = await prisma.user.findUnique({ where: { email } });
    
    // Don't reveal if user exists or not (security best practice)
    if (!user) {
      // Still return success to prevent email enumeration
      return { ok: true, message: "If an account exists with this email, a password reset link has been sent." };
    }
    
    // Generate reset token
    const resetToken = generateResetToken();
    const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    // Save reset token to user
    try {
      await prisma.user.update({
        where: { email },
        data: {
          resetToken,
          resetTokenExpiresAt: tokenExpiresAt,
        },
      });
    } catch (dbError) {
      console.error("Database error updating reset token:", dbError);
      // Check if it's a missing column error
      if (dbError && typeof dbError === 'object' && 'code' in dbError) {
        const errorCode = (dbError as any).code;
        if (errorCode === '42703' || errorCode === '42P01') {
          console.error("❌ Database migration not run! resetToken fields don't exist.");
          return { ok: false, error: "Database migration required. Please contact administrator." };
        }
      }
      throw dbError; // Re-throw if it's a different error
    }
    
    // Send password reset email
    try {
      const emailResult = await sendPasswordResetEmail(
        email,
        user.name || "User",
        resetToken
      );
      if (!emailResult.success) {
        console.error("Failed to send password reset email:", emailResult.error);
      }
    } catch (err) {
      console.error("Password reset email send threw:", err);
    }
    
    // Always return success (security: don't reveal if email exists)
    return { ok: true, message: "If an account exists with this email, a password reset link has been sent." };
  } catch (error) {
    console.error("Request password reset error:", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function resetPassword(formData: FormData) {
  try {
    const data = Object.fromEntries(formData.entries());
    const parsed = resetPasswordSchema.safeParse(data);
    
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0]?.message || "Invalid input" };
    }
    
    const { email, token, password } = parsed.data;
    
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return { ok: false, error: "User not found" };
    }
    
    // Check if reset token exists and is valid
    if (!user.resetToken || !user.resetTokenExpiresAt) {
      return { ok: false, error: "Invalid or expired reset token" };
    }
    
    // Check if token matches
    if (user.resetToken !== token) {
      return { ok: false, error: "Invalid reset token" };
    }
    
    // Check if token is expired
    if (new Date() > user.resetTokenExpiresAt) {
      return { ok: false, error: "Reset token has expired. Please request a new one." };
    }
    
    // Hash new password
    const passwordHash = await hash(password, 10);
    
    // Update password and clear reset token
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    });
    
    return { ok: true, message: "Password reset successfully. You can now sign in with your new password." };
  } catch (error) {
    console.error("Reset password error:", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
