"use server";

import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";
import { generateVerificationCode, sendVerificationEmail } from "@/lib/email";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  registrationCode: z.string().optional(),
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
    
    const { name, email, password, registrationCode } = parsed.data;
    
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
    
    // Create user (not verified yet)
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        isVerified: false,
        verificationCode,
        codeExpiresAt,
      },
    });
    
    // Send verification email (non-fatal)
    try {
      const emailResult = await sendVerificationEmail(email, name, verificationCode, role);
      if (!emailResult.success) {
        console.error("Failed to send verification email:", emailResult.error);
      }
    } catch (err) {
      console.error("Email send threw:", err);
    }
    
    return { ok: true, email };
  } catch (error) {
    console.error("Register error:", error);
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

