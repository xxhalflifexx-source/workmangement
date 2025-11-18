import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY || "";
// Check if email is disabled - be more strict about what counts as "disabled"
const isEmailDisabled = !resendApiKey || 
  resendApiKey.trim() === "" || 
  resendApiKey.toLowerCase().includes("placeholder") ||
  resendApiKey.toLowerCase().includes("replace") ||
  !resendApiKey.startsWith("re_"); // Resend keys always start with "re_"

const resend = isEmailDisabled ? null : new Resend(resendApiKey);

// Generate a random 6-digit verification code
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send verification email with code
export async function sendVerificationEmail(
  email: string,
  name: string,
  code: string,
  role: string
) {
  if (isEmailDisabled) {
    // Log warning - this should be fixed in production!
    console.error("❌ EMAIL SENDING DISABLED - RESEND_API_KEY is missing or invalid!");
    console.error("   This means verification codes will NOT be sent to users.");
    console.error("   To fix: Add valid RESEND_API_KEY to Vercel environment variables.");
    console.error("   Current value:", resendApiKey ? `${resendApiKey.substring(0, 10)}...` : "MISSING");
    // Still return success to not break registration, but log the error
    return { success: false, error: "Email service not configured. Please contact administrator." } as const;
  }
  console.log(`📧 Attempting to send email to: ${email}`);
  console.log(`🔐 Verification code: ${code}`);
  console.log(`🔑 API Key present: ${!!process.env.RESEND_API_KEY}`);
  console.log(`🔑 API Key starts with: ${process.env.RESEND_API_KEY?.substring(0, 6)}...`);
  
  if (!resend) {
    console.error("❌ Resend client not initialized - API key invalid");
    return { success: false, error: "Email service not configured" };
  }
  
  try {
    const { data, error } = await resend.emails.send({
      from: "TCB Metal Works <noreply@send.tcbmetalworks.com>",
      to: [email],
      subject: "Verify Your Account - Security Code",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .code-box { background-color: white; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
              .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb; }
              .role-badge { display: inline-block; background-color: #dbeafe; color: #1e40af; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔐 Verify Your Account</h1>
              </div>
              <div class="content">
                <h2>Welcome, ${name}!</h2>
                <p>Thank you for registering. To complete your registration and verify you're human, please use the security code below:</p>
                
                <div class="code-box">
                  <div class="code">${code}</div>
                </div>
                
                <p><strong>Your Role:</strong> <span class="role-badge">${role}</span></p>
                
                <p>This code will expire in <strong>15 minutes</strong>.</p>
                
                <p>If you didn't create an account, you can safely ignore this email.</p>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                
                <p style="font-size: 14px; color: #6b7280;">
                  <strong>Security Tip:</strong> Never share this code with anyone. We'll never ask for your code via phone or email.
                </p>
              </div>
              <div class="footer">
                <p>This email was sent to ${email}</p>
                <p>&copy; 2024 Your App. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("❌ Email send error:", JSON.stringify(error, null, 2));
      return { success: false, error };
    }

    console.log(`✅ Email sent successfully! ID: ${data?.id}`);
    return { success: true, data };
  } catch (error) {
    console.error("Email send exception:", error);
    return { success: false, error };
  }
}

// Generate a secure random token for password reset
export function generateResetToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// Send password reset email
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetToken: string
) {
  if (isEmailDisabled) {
    console.error("❌ EMAIL SENDING DISABLED - RESEND_API_KEY is missing or invalid!");
    return { success: false, error: "Email service not configured. Please contact administrator." } as const;
  }
  
  console.log(`📧 Attempting to send password reset email to: ${email}`);
  
  if (!resend) {
    console.error("❌ Resend client not initialized - API key invalid");
    return { success: false, error: "Email service not configured" };
  }

  const resetUrl = `${process.env.NEXTAUTH_URL || "https://nextjs-auth-roles.vercel.app"}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
  
  try {
    const { data, error } = await resend.emails.send({
      from: "TCB Metal Works <noreply@send.tcbmetalworks.com>",
      to: [email],
      subject: "Reset Your Password",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
              .warning { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔒 Reset Your Password</h1>
              </div>
              <div class="content">
                <h2>Hello, ${name}!</h2>
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                
                <div style="text-align: center;">
                  <a href="${resetUrl}" class="button">Reset Password</a>
                </div>
                
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #2563eb;">${resetUrl}</p>
                
                <div class="warning">
                  <p><strong>⚠️ Security Notice:</strong></p>
                  <p>This link will expire in <strong>1 hour</strong>.</p>
                  <p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
                </div>
              </div>
              <div class="footer">
                <p>This email was sent to ${email}</p>
                <p>&copy; 2024 TCB Metal Works. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("❌ Password reset email send error:", JSON.stringify(error, null, 2));
      return { success: false, error };
    }

    console.log(`✅ Password reset email sent successfully! ID: ${data?.id}`);
    return { success: true, data };
  } catch (error) {
    console.error("Password reset email send exception:", error);
    return { success: false, error };
  }
}
