import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY || "";
// Check if email is disabled - be more strict about what counts as "disabled"
const isEmailDisabled =
  !resendApiKey ||
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

  // Always use production URL for password reset emails so links work reliably
  // Preview deployments can fail, but production is always available
  const productionUrl = process.env.PRODUCTION_URL || "https://shoptofield.com/app";
  const resetUrl = `${productionUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
  
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

/**
 * Generic notification email helper for job/QC updates.
 * Used so workers and managers get notified when job status changes (e.g. REWORK).
 */
export async function sendJobStatusEmail(
  to: string | null | undefined,
  jobTitle: string,
  newStatus: string,
  message?: string
) {
  if (!to) {
    return { success: false, error: "Missing recipient email" } as const;
  }

  if (isEmailDisabled || !resend) {
    console.error(
      "❌ EMAIL SENDING DISABLED - cannot send job status email for",
      jobTitle,
      "to",
      to
    );
    return {
      success: false,
      error: "Email service not configured",
    } as const;
  }

  const safeStatus = newStatus.toUpperCase();
  const subject = `Job "${jobTitle}" updated: ${safeStatus}`;

  const extraMessage =
    message && message.trim().length > 0
      ? message.trim()
      : "There has been an update to this job. Please log in to review the details.";

  const productionUrl =
    process.env.PRODUCTION_URL || "https://shoptofield.com/app";

  const jobLink = `${productionUrl}/jobs`;

  try {
    const { data, error } = await resend.emails.send({
      from: "TCB Metal Works <noreply@send.tcbmetalworks.com>",
      to: [to],
      subject,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #111827; background-color: #f3f4f6; }
              .container { max-width: 640px; margin: 0 auto; padding: 24px; }
              .card { background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(15,23,42,0.08); }
              .header { background-color: #1e3a8a; padding: 20px 24px; color: #eff6ff; }
              .title { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
              .subtitle { font-size: 13px; color: #bfdbfe; margin: 0; }
              .content { padding: 24px; background-color: #f9fafb; }
              .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; letter-spacing: .03em; }
              .badge-status { background-color: #e0f2fe; color: #075985; }
              .job-title { font-size: 16px; font-weight: 600; margin: 12px 0 4px; color: #111827; }
              .message { font-size: 14px; color: #374151; margin: 12px 0 16px; white-space: pre-line; }
              .button { display: inline-block; background-color: #1d4ed8; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 999px; font-size: 13px; font-weight: 600; }
              .meta { font-size: 12px; color: #6b7280; margin-top: 18px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="card">
                <div class="header">
                  <p class="title">Job Update</p>
                  <p class="subtitle">There has been a change in job status at TCB Metal Works.</p>
                </div>
                <div class="content">
                  <span class="badge badge-status">STATUS: ${safeStatus}</span>
                  <p class="job-title">${jobTitle}</p>
                  <p class="message">${extraMessage}</p>
                  <a href="${jobLink}" class="button">Open Job Management</a>
                  <p class="meta">
                    You are receiving this email because you are assigned to this job or created it.
                  </p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error(
        "❌ Job status email send error:",
        JSON.stringify(error, null, 2)
      );
      return { success: false, error };
    }

    console.log(`✅ Job status email sent successfully! ID: ${data?.id}`);
    return { success: true, data };
  } catch (error) {
    console.error("Job status email exception:", error);
    return { success: false, error };
  }
}

/**
 * Types for EOD Report Email
 */
export interface EodEmployeeSummaryEmail {
  name: string;
  email: string | null;
  netWorkHours: number;
  breakHours: number;
  paidHours: number;
  hourlyRate: number;
  laborCost: number;
  workDescription: string[];
  jobsWorked: { title: string; hours: number }[];
  flags: string[];
}

export interface EodJobSnapshotEmail {
  title: string;
  jobNumber: string | null;
  revenue: number | null;
  revenueSource: string | null;
  budget: number | null;
  hoursToday: number;
  costToday: { labor: number; materials: number; other: number; total: number };
  costToDate: { labor: number; materials: number; other: number; total: number };
  profit: number | null;
  margin: number | null;
  budgetRemaining: number | null;
  budgetUsedPercent: number | null;
  status: string;
  alerts: string[];
}

/**
 * Send End-of-Day report email
 */
export async function sendEodReportEmail(
  to: string[],
  reportDate: string,
  orgName: string,
  summary: {
    totalLaborHours: number;
    totalLaborCost: number;
    employeeCount: number;
    jobCount: number;
    flagCount: number;
  },
  employees: EodEmployeeSummaryEmail[],
  jobs: EodJobSnapshotEmail[],
  exceptions: string[]
) {
  if (to.length === 0) {
    return { success: false, error: "No recipients specified" } as const;
  }

  if (isEmailDisabled || !resend) {
    console.error("❌ EMAIL SENDING DISABLED - cannot send EOD report");
    return {
      success: false,
      error: "Email service not configured",
    } as const;
  }

  const productionUrl = process.env.PRODUCTION_URL || "https://shoptofield.com/app";

  // Format currency helper
  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatHours = (hours: number) => `${hours.toFixed(1)}h`;
  const formatPercent = (decimal: number | null) => 
    decimal !== null ? `${(decimal * 100).toFixed(1)}%` : 'N/A';

  // Build employee cards HTML
  const employeeCardsHtml = employees.map(emp => `
    <div style="background: #ffffff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <div>
          <strong style="font-size: 15px; color: #111827;">${emp.name}</strong>
          ${emp.email ? `<div style="font-size: 12px; color: #6b7280;">${emp.email}</div>` : ''}
        </div>
        <div style="text-align: right;">
          <div style="font-size: 16px; font-weight: 600; color: #059669;">${formatCurrency(emp.laborCost)}</div>
          <div style="font-size: 11px; color: #6b7280;">@ ${formatCurrency(emp.hourlyRate)}/hr</div>
        </div>
      </div>
      <div style="display: flex; gap: 16px; margin-bottom: 8px; font-size: 13px;">
        <div><span style="color: #6b7280;">Work:</span> <strong>${formatHours(emp.netWorkHours)}</strong></div>
        <div><span style="color: #6b7280;">Break:</span> ${formatHours(emp.breakHours)}</div>
        <div><span style="color: #6b7280;">Paid:</span> ${formatHours(emp.paidHours)}</div>
      </div>
      ${emp.jobsWorked.length > 0 ? `
        <div style="font-size: 12px; color: #374151; margin-bottom: 8px;">
          <strong>Jobs:</strong> ${emp.jobsWorked.map(j => `${j.title} (${formatHours(j.hours)})`).join(', ')}
        </div>
      ` : ''}
      ${emp.workDescription.length > 0 ? `
        <div style="font-size: 12px; color: #6b7280; background: #f9fafb; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
          ${emp.workDescription.map(d => `• ${d}`).join('<br>')}
        </div>
      ` : ''}
      ${emp.flags.length > 0 ? `
        <div style="margin-top: 8px;">
          ${emp.flags.map(f => `<span style="display: inline-block; background: ${f === 'over_cap' || f === 'open_entry' ? '#fef2f2' : '#fef9c3'}; color: ${f === 'over_cap' || f === 'open_entry' ? '#991b1b' : '#854d0e'}; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-right: 4px; text-transform: uppercase;">${f.replace('_', ' ')}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  // Build job cards HTML (better for showing budget info)
  const jobCardsHtml = jobs.map(job => {
    const budgetUsedPct = job.budgetUsedPercent !== null ? Math.min(job.budgetUsedPercent * 100, 100) : 0;
    const budgetBarColor = job.budgetUsedPercent !== null 
      ? (job.budgetUsedPercent > 1 ? '#dc2626' : job.budgetUsedPercent > 0.8 ? '#f59e0b' : '#059669')
      : '#9ca3af';
    
    return `
    <div style="background: #ffffff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div>
          <div style="font-weight: 600; font-size: 15px; color: #111827;">${job.title}</div>
          ${job.jobNumber ? `<div style="font-size: 11px; color: #6b7280;">${job.jobNumber}</div>` : ''}
          <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">Status: ${job.status}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; color: #6b7280;">Today: ${formatHours(job.hoursToday)}</div>
        </div>
      </div>
      
      <!-- Budget/Revenue vs Cost Bar -->
      ${job.budget !== null ? `
        <div style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <span style="color: #6b7280;">Budget: ${formatCurrency(job.budget)}</span>
            <span style="color: ${budgetBarColor}; font-weight: 600;">${budgetUsedPct.toFixed(0)}% used</span>
          </div>
          <div style="background: #e5e7eb; border-radius: 4px; height: 8px; overflow: hidden;">
            <div style="background: ${budgetBarColor}; height: 100%; width: ${Math.min(budgetUsedPct, 100)}%; transition: width 0.3s;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 4px;">
            <span style="color: #6b7280;">Spent: ${formatCurrency(job.costToDate.total)}</span>
            <span style="color: ${job.budgetRemaining !== null && job.budgetRemaining >= 0 ? '#059669' : '#dc2626'};">
              ${job.budgetRemaining !== null ? (job.budgetRemaining >= 0 ? `${formatCurrency(job.budgetRemaining)} remaining` : `${formatCurrency(Math.abs(job.budgetRemaining))} over`) : ''}
            </span>
          </div>
        </div>
      ` : `
        <div style="margin-bottom: 12px; padding: 8px; background: #fef2f2; border-radius: 4px;">
          <span style="color: #991b1b; font-size: 12px;">⚠️ No budget/price set for this job</span>
        </div>
      `}
      
      <!-- Cost Breakdown -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px;">
        <div style="background: #f9fafb; padding: 8px; border-radius: 4px;">
          <div style="color: #6b7280; font-size: 10px; text-transform: uppercase;">Today's Cost</div>
          <div style="font-weight: 600; color: #111827;">${formatCurrency(job.costToday.total)}</div>
          <div style="color: #6b7280; font-size: 10px;">Labor: ${formatCurrency(job.costToday.labor)}</div>
        </div>
        <div style="background: #f9fafb; padding: 8px; border-radius: 4px;">
          <div style="color: #6b7280; font-size: 10px; text-transform: uppercase;">Total Cost</div>
          <div style="font-weight: 600; color: #111827;">${formatCurrency(job.costToDate.total)}</div>
          <div style="color: #6b7280; font-size: 10px;">Labor: ${formatCurrency(job.costToDate.labor)}</div>
        </div>
      </div>
      
      <!-- Profit/Margin -->
      ${job.profit !== null ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between;">
          <div>
            <span style="font-size: 11px; color: #6b7280;">Profit: </span>
            <span style="font-weight: 600; color: ${job.profit >= 0 ? '#059669' : '#dc2626'};">${formatCurrency(job.profit)}</span>
          </div>
          <div>
            <span style="font-size: 11px; color: #6b7280;">Margin: </span>
            <span style="font-weight: 600; color: ${job.margin !== null && job.margin < 0.2 ? '#dc2626' : '#059669'};">${formatPercent(job.margin)}</span>
          </div>
        </div>
      ` : ''}
      
      ${job.alerts.length > 0 ? `
        <div style="margin-top: 8px;">
          ${job.alerts.map(a => `<span style="display: inline-block; background: ${a === 'over_budget' ? '#fef2f2' : '#fef9c3'}; color: ${a === 'over_budget' ? '#991b1b' : '#854d0e'}; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-right: 4px; text-transform: uppercase;">${a.replace(/_/g, ' ')}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `}).join('');

  // Build exceptions list HTML
  const exceptionsHtml = exceptions.length > 0 ? `
    <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin-top: 24px; border: 1px solid #fecaca;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #991b1b;">⚠️ Exceptions & Flags (${exceptions.length})</h3>
      <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #7f1d1d;">
        ${exceptions.map(e => `<li style="margin-bottom: 4px;">${e}</li>`).join('')}
      </ul>
    </div>
  ` : '';

  const subject = `Daily Report — ${orgName} — ${reportDate}`;

  try {
    const { data, error } = await resend.emails.send({
      from: "TCB Metal Works <noreply@send.tcbmetalworks.com>",
      to,
      subject,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #111827; background-color: #f3f4f6; margin: 0; padding: 0; }
              .container { max-width: 680px; margin: 0 auto; padding: 24px; }
              .card { background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
              .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 24px; color: white; }
              .header h1 { margin: 0 0 4px 0; font-size: 22px; font-weight: 700; }
              .header p { margin: 0; font-size: 14px; opacity: 0.9; }
              .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px; background: #e5e7eb; }
              .summary-item { background: #f9fafb; padding: 16px 12px; text-align: center; }
              .summary-value { font-size: 20px; font-weight: 700; color: #111827; }
              .summary-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
              .section { padding: 24px; }
              .section-title { font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
              table { width: 100%; border-collapse: collapse; font-size: 13px; }
              th { text-align: left; padding: 8px; background: #f9fafb; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; }
              .footer { padding: 16px 24px; background: #f9fafb; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
              .footer a { color: #2563eb; text-decoration: none; }
              @media (max-width: 600px) {
                .summary-grid { grid-template-columns: repeat(3, 1fr); }
                .container { padding: 12px; }
                .section { padding: 16px; }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="card">
                <div class="header">
                  <h1>📊 Daily Report</h1>
                  <p>${orgName} — ${reportDate}</p>
                </div>

                <!-- Summary Grid -->
                <div class="summary-grid">
                  <div class="summary-item">
                    <div class="summary-value">${formatHours(summary.totalLaborHours)}</div>
                    <div class="summary-label">Labor Hours</div>
                  </div>
                  <div class="summary-item">
                    <div class="summary-value">${formatCurrency(summary.totalLaborCost)}</div>
                    <div class="summary-label">Labor Cost</div>
                  </div>
                  <div class="summary-item">
                    <div class="summary-value">${summary.employeeCount}</div>
                    <div class="summary-label">Employees</div>
                  </div>
                  <div class="summary-item">
                    <div class="summary-value">${summary.jobCount}</div>
                    <div class="summary-label">Jobs</div>
                  </div>
                  <div class="summary-item">
                    <div class="summary-value" style="color: ${summary.flagCount > 0 ? '#dc2626' : '#059669'};">${summary.flagCount}</div>
                    <div class="summary-label">Flags</div>
                  </div>
                </div>

                <!-- Employee Section -->
                ${employees.length > 0 ? `
                  <div class="section">
                    <h2 class="section-title">👥 Employee Activity</h2>
                    ${employeeCardsHtml}
                  </div>
                ` : ''}

                <!-- Job Profit Section -->
                ${jobs.length > 0 ? `
                  <div class="section" style="padding-top: 0;">
                    <h2 class="section-title">💼 Job Budget vs Cost</h2>
                    ${jobCardsHtml}
                  </div>
                ` : ''}

                <!-- Exceptions -->
                ${exceptionsHtml ? `<div class="section" style="padding-top: 0;">${exceptionsHtml}</div>` : ''}

                <!-- Footer -->
                <div class="footer">
                  <p style="margin: 0 0 8px 0;">
                    <a href="${productionUrl}/hr">View HR Dashboard</a> • 
                    <a href="${productionUrl}/jobs">View Jobs</a> • 
                    <a href="${productionUrl}/finance">View Finance</a>
                  </p>
                  <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${orgName}. Generated automatically.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("❌ EOD Report email send error:", JSON.stringify(error, null, 2));
      return { success: false, error };
    }

    console.log(`✅ EOD Report email sent successfully! ID: ${data?.id}, Recipients: ${to.join(', ')}`);
    return { success: true, data };
  } catch (error) {
    console.error("EOD Report email exception:", error);
    return { success: false, error };
  }
}

