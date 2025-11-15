# ✅ How to Ensure Emails Are Sent to Business Emails

## 🎯 The Goal

Make sure verification codes are **always sent** to business emails when users register.

---

## 🔍 Current Problem

The system **skips sending emails** when:
- ❌ `RESEND_API_KEY` is missing
- ❌ `RESEND_API_KEY` is set to placeholder/default value
- ❌ API key is invalid or expired

**Code that checks this:**
```typescript
// lib/email.ts
const resendApiKey = process.env.RESEND_API_KEY || "";
const isEmailDisabled = !resendApiKey || resendApiKey.toLowerCase() === "placeholder";

if (isEmailDisabled) {
  console.log("📭 Email sending disabled (no RESEND_API_KEY). Skipping send.");
  return { success: true } as const; // ❌ Silently fails!
}
```

---

## ✅ Solution: Configure Resend API Key Properly

### Step 1: Get Resend API Key

1. **Go to https://resend.com/**
2. **Sign up** (free account - 3,000 emails/month)
3. **Verify your email** (check inbox)
4. **Go to Dashboard** → **API Keys**
5. **Click "Create API Key"**
6. **Name it:** "Production" or "Vercel Production"
7. **Select:** "Full Access" permission
8. **Click "Create"**
9. **Copy the key** (starts with `re_...`)
   - ⚠️ **Save it immediately!** You won't see it again

---

### Step 2: Add to Vercel Environment Variables

**This is critical!** The API key must be in Vercel for the live site.

1. **Go to https://vercel.com**
2. **Log in** to your account
3. **Find your project** (nextjs-auth-roles)
4. **Click on the project**
5. **Go to Settings** (top menu)
6. **Click "Environment Variables"** (left sidebar)
7. **Click "Add New"**
8. **Fill in:**
   - **Key:** `RESEND_API_KEY`
   - **Value:** `re_your_actual_api_key_here` (paste the key you copied)
   - **Environment:** 
     - ✅ **Production** (check this!)
     - ✅ **Preview** (check this!)
     - ✅ **Development** (optional, for testing)
9. **Click "Save"**

---

### Step 3: Redeploy the Project

**Important:** Environment variables only take effect after redeployment!

**Option A: Automatic (Recommended)**
- Push any code change to Git
- Vercel will auto-deploy with new environment variables

**Option B: Manual Redeploy**
1. Go to Vercel Dashboard → Your Project
2. Click **"Deployments"** tab
3. Find the latest deployment
4. Click **"..."** (three dots)
5. Click **"Redeploy"**
6. Wait for deployment to complete

---

### Step 4: Verify It's Working

**Test the email system:**

1. **Register a new test account:**
   - Use a real business email you can check
   - Complete registration
   - Check your email inbox

2. **Check Vercel Logs:**
   - Go to Vercel Dashboard → Your Project → Deployments
   - Click on latest deployment → **"Logs"**
   - Look for email-related messages:
     - ✅ `📧 Attempting to send email to: ...`
     - ✅ `✅ Email sent successfully!`
     - ❌ `📭 Email sending disabled` (means it's not working)

3. **Check Resend Dashboard:**
   - Go to https://resend.com/dashboard
   - Click **"Emails"** tab
   - You should see sent emails listed
   - Check delivery status

---

## 🔧 Additional Configuration

### Update Email Sender (Optional but Recommended)

**Current default:**
```typescript
from: "Your App <onboarding@resend.dev>"
```

**Better option (after domain verification):**
```typescript
from: "TCB Metal Works <noreply@yourdomain.com>"
```

**To do this:**

1. **Verify your domain in Resend:**
   - Go to Resend Dashboard → **Domains**
   - Click **"Add Domain"**
   - Follow verification steps
   - Add DNS records to your domain

2. **Update the code:**
   - Edit `lib/email.ts`
   - Change line 31:
   ```typescript
   from: "TCB Metal Works <noreply@yourdomain.com>",
   ```

3. **Deploy the change**

---

## 🛡️ Prevent Future Issues

### Add Monitoring/Logging

**Check email sending status in logs:**

The system already logs email attempts. Monitor these:

```typescript
// Already in lib/email.ts
console.log(`📧 Attempting to send email to: ${email}`);
console.log(`🔐 Verification code: ${code}`);
console.log(`🔑 API Key present: ${!!process.env.RESEND_API_KEY}`);
```

**Set up alerts:**
- Monitor Vercel logs for email failures
- Check Resend dashboard for delivery issues
- Set up email notifications for failed sends

---

### Add Error Handling (Improvement)

**Current issue:** System silently skips sending if API key is missing.

**Better approach:** Show error to user if email fails.

**You could modify `app/(auth)/actions.ts`:**

```typescript
// After registration, check if email was sent
const emailResult = await sendVerificationEmail(...);

if (!emailResult.success) {
  // Log error
  console.error("Failed to send verification email:", emailResult.error);
  
  // Option 1: Still create account, but show warning
  // Option 2: Fail registration with clear error message
  // Option 3: Send to admin for manual verification
}
```

---

## ✅ Checklist: Ensure Emails Always Send

### Production Setup:
- [ ] Resend account created
- [ ] API key generated
- [ ] API key added to Vercel environment variables
- [ ] Environment set to **Production** (and Preview)
- [ ] Project redeployed after adding API key
- [ ] Tested with real business email
- [ ] Email received successfully
- [ ] Verified in Resend dashboard

### Monitoring:
- [ ] Check Vercel logs regularly
- [ ] Monitor Resend dashboard for delivery issues
- [ ] Set up alerts for email failures
- [ ] Test registration flow periodically

### Code:
- [ ] API key is valid (not placeholder)
- [ ] Email sending is not disabled
- [ ] Error handling is in place
- [ ] Logs show email attempts

---

## 🧪 Testing Checklist

**Test these scenarios:**

1. **Normal Registration:**
   - ✅ Register with business email
   - ✅ Receive verification code
   - ✅ Code works on verification page

2. **Different Email Providers:**
   - ✅ Gmail
   - ✅ Outlook/Office 365
   - ✅ Business email domains
   - ✅ Check spam folders

3. **Error Scenarios:**
   - ✅ Invalid email format (should fail gracefully)
   - ✅ API key missing (should log error)
   - ✅ API key invalid (should log error)

---

## 🆘 Troubleshooting

### "Emails still not sending"

1. **Check Vercel Environment Variables:**
   - Go to Settings → Environment Variables
   - Verify `RESEND_API_KEY` exists
   - Check it's set for **Production** environment
   - Make sure value is correct (starts with `re_`)

2. **Check if Project Was Redeployed:**
   - Environment variables only work after redeploy
   - Check deployment logs for errors

3. **Check Resend Dashboard:**
   - Go to https://resend.com/dashboard
   - Check **"API Keys"** - make sure key is active
   - Check **"Emails"** - see if emails are being sent
   - Check for any errors or warnings

4. **Check Vercel Logs:**
   - Look for email-related log messages
   - Check for error messages
   - Verify API key is being read

5. **Test API Key:**
   - Try sending a test email from Resend dashboard
   - Verify the key works

---

## 📋 Quick Reference

### To Fix Email Sending:

```bash
# 1. Get API key from Resend
https://resend.com/ → API Keys → Create

# 2. Add to Vercel
Vercel Dashboard → Project → Settings → Environment Variables
Key: RESEND_API_KEY
Value: re_your_key_here
Environment: Production, Preview

# 3. Redeploy
Vercel Dashboard → Deployments → Redeploy

# 4. Test
Register new account → Check email → Verify code works
```

---

## 🎯 Summary

**To ensure emails are ALWAYS sent:**

1. ✅ **Configure Resend API key** in Vercel
2. ✅ **Set for Production environment**
3. ✅ **Redeploy the project**
4. ✅ **Test with real business email**
5. ✅ **Monitor logs and dashboard**

**Once configured, emails will be sent automatically to all business emails!** 🚀

---

## 💡 Pro Tips

1. **Use Resend's free tier** - 3,000 emails/month is plenty for most businesses
2. **Monitor usage** - Check Resend dashboard to see email count
3. **Set up domain** - Verify your domain for better deliverability
4. **Test regularly** - Register test accounts to verify emails work
5. **Check spam folders** - Some emails might go to spam initially

---

**Follow these steps and emails will be sent to all business emails!** ✅

