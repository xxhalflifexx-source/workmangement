# Email Verification Setup Guide

Your authentication system now includes **email verification with security codes**! 🔐

## 🎯 What's New

### Email Verification Flow:
1. **User registers** → Account created (not verified)
2. **Random 6-digit code generated** → Sent to their email
3. **User enters code** on verification page
4. **Email verified** → Can now log in

### Security Features:
✅ **Human verification** - Proves they own the email  
✅ **6-digit random codes** - Hard to guess  
✅ **15-minute expiration** - Codes expire for security  
✅ **No login without verification** - Blocks unverified accounts  

---

## 🚀 Get Your FREE Resend API Key

### Step 1: Sign Up for Resend (Free)

1. Visit: **https://resend.com/**
2. Click **"Start Building"** or **"Sign Up"**
3. Create a free account (GitHub or email)
4. **Free tier includes: 3,000 emails/month** ✅

### Step 2: Get Your API Key

1. After signing in, go to **API Keys** in the dashboard
2. Click **"Create API Key"**
3. Give it a name (e.g., "Development" or "NextAuth App")
4. Select **"Full Access"** for sending permission
5. Click **"Create"**
6. **Copy your API key** (starts with `re_...`)
   - ⚠️ Save it now! You won't see it again

### Step 3: Add API Key to Your Project

Open your `.env` file and update:

```env
RESEND_API_KEY="re_your_actual_api_key_here"
```

Replace `re_placeholder_get_from_resend_com` with your real API key.

### Step 4: Update Email Sender (Optional but Recommended)

Edit `lib/email.ts` line 18:

```typescript
from: "Your App <onboarding@resend.dev>", // Default (works but shows "via resend.dev")
```

To use your own domain (after verifying it in Resend):

```typescript
from: "Your App <noreply@yourdomain.com>",
```

**For now, the default `onboarding@resend.dev` works perfectly for testing!**

---

## 🧪 Testing Email Verification

### Test the Complete Flow:

1. **Register a new account**
   ```
   http://localhost:3000/register
   
   Name: Test User
   Email: your-real-email@gmail.com (use YOUR email to receive the code)
   Password: password123
   Registration Code: (leave empty or use sunrise/sunset/moonlight)
   ```

2. **Check your email inbox**
   - Look for email from "Your App"
   - Subject: "Verify Your Account - Security Code"
   - Contains a 6-digit code (e.g., 482019)

3. **Enter the code**
   - You'll be redirected to `/verify`
   - Enter the 6-digit code from your email
   - Click "Verify Email"

4. **Login**
   - Redirected to `/login` with success message
   - Login with your new account
   - Access the dashboard

### What Happens If...

**You don't verify your email?**
- ❌ Cannot log in
- Error: "Please verify your email before logging in"

**The code expires (15 minutes)?**
- ❌ "Verification code expired"
- Need to register again (or implement resend feature)

**You enter wrong code?**
- ❌ "Invalid verification code"
- Try again (you have unlimited attempts)

**You already verified?**
- ✅ Can log in normally
- No need to verify again

---

## 📊 Database Changes

### New Fields in User Model:

```prisma
model User {
  // ... existing fields ...
  isVerified       Boolean   @default(false)   // Email verified?
  verificationCode String?                     // 6-digit code
  codeExpiresAt    DateTime?                   // Expiration time
}
```

### Existing Test Users:

✅ **All existing test accounts are already verified:**
- admin@example.com / Passw0rd!
- manager@example.com / Passw0rd!
- employee@example.com / Passw0rd!

They can log in immediately without verification.

---

## 🎨 Email Template

The verification email includes:

- 🔐 **Security-themed design**
- **6-digit code** in large, easy-to-read format
- **User's role badge** (Employee/Manager/Admin)
- **15-minute expiration warning**
- **Professional HTML styling**

### Example Email:

```
Subject: Verify Your Account - Security Code

🔐 Verify Your Account

Welcome, John Doe!

Thank you for registering. To complete your registration and verify 
you're human, please use the security code below:

┌──────────────┐
│   482019     │
└──────────────┘

Your Role: [EMPLOYEE]

This code will expire in 15 minutes.

If you didn't create an account, you can safely ignore this email.
```

---

## 🛠️ How It Works (Technical)

### Registration Flow:

1. **User submits registration form**
2. **Server generates random 6-digit code**
3. **Code stored in database** with 15-minute expiration
4. **Email sent via Resend API**
5. **User redirected to verification page**

### Verification Flow:

1. **User enters code on `/verify` page**
2. **Server checks code against database**
3. **Validates: exists, not expired, matches**
4. **Updates user: `isVerified = true`**
5. **Clears verification code from database**
6. **Redirects to login**

### Login Protection:

1. **User attempts to log in**
2. **Server checks `isVerified` status**
3. **If false: throws error "Please verify your email"**
4. **If true: allows login**

---

## 📝 Files Created/Modified

### New Files:
- `lib/email.ts` - Email utility with Resend integration
- `app/verify/page.tsx` - Verification code entry page
- `scripts/verify-existing-users.ts` - Script to verify old accounts
- `EMAIL_SETUP_GUIDE.md` - This file

### Modified Files:
- `prisma/schema.prisma` - Added verification fields
- `app/(auth)/actions.ts` - Added `verifyEmail()` function
- `app/register/page.tsx` - Redirects to `/verify`
- `app/login/page.tsx` - Shows verification success message
- `lib/authOptions.ts` - Checks verification before login
- `.env` - Added `RESEND_API_KEY`
- `.env.example` - Added `RESEND_API_KEY` example

---

## 🔒 Security Features

1. **6-digit random codes** - 1 in 1,000,000 chance to guess
2. **15-minute expiration** - Time-limited validity
3. **Server-side validation** - Cannot be bypassed
4. **Login blocking** - Unverified users cannot access app
5. **One-time use** - Code cleared after successful verification

---

## 🎯 Production Checklist

Before going live:

- [ ] Get Resend API key
- [ ] Verify your domain in Resend dashboard
- [ ] Update `from` email in `lib/email.ts`
- [ ] Test with multiple email providers (Gmail, Outlook, etc.)
- [ ] Check spam folders
- [ ] Implement "Resend Code" feature
- [ ] Add rate limiting to prevent abuse
- [ ] Set up email monitoring/logging
- [ ] Update email template with your branding

---

## 💡 Future Enhancements

### Easy Additions:

1. **Resend Code Button** - Let users request a new code
2. **Email Templates** - Use React Email for better templates
3. **Code via SMS** - Add phone verification option
4. **Magic Links** - Click link instead of entering code
5. **Welcome Email** - Send after successful verification

### Implementation Tips:

```typescript
// Resend code (add to actions.ts)
export async function resendCode(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.isVerified) return { ok: false };
  
  const newCode = generateVerificationCode();
  const newExpiry = new Date(Date.now() + 15 * 60 * 1000);
  
  await prisma.user.update({
    where: { email },
    data: { verificationCode: newCode, codeExpiresAt: newExpiry },
  });
  
  await sendVerificationEmail(email, user.name, newCode, user.role);
  return { ok: true };
}
```

---

## 🆘 Troubleshooting

### "Email not received"

1. **Check spam/junk folder**
2. **Verify API key is correct** in `.env`
3. **Check Resend dashboard** for send logs
4. **Try different email** (some providers block)
5. **Check console logs** for errors

### "RESEND_API_KEY is not defined"

1. Make sure `.env` file has the key
2. Restart dev server: Stop and run `npm run dev` again
3. Check for typos in variable name

### "Please verify your email before logging in"

This means the account exists but isn't verified yet:
1. Check your email for the code
2. Go to `/verify` with your email
3. Enter the code
4. Then try logging in again

### "Verification code expired"

Codes expire after 15 minutes:
1. Register again (will overwrite old code)
2. Or implement resend code feature

---

## 📧 Resend Dashboard

Access your Resend dashboard to:
- View sent emails
- Check delivery status
- Monitor API usage
- Add custom domains
- Set up webhooks

**Dashboard URL:** https://resend.com/dashboard

---

## 🎉 You're All Set!

Your authentication system now has:
✅ Email verification with security codes  
✅ Human verification (proves email ownership)  
✅ Professional email templates  
✅ 15-minute code expiration  
✅ Login protection for unverified users  

**Next Step:** Get your Resend API key and start testing!

Visit: **https://resend.com/** to sign up for free!



