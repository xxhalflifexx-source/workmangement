# 🔄 How to Update Environment Variables for New Domain

This guide will help you update the environment variables to use `https://shoptofield.com/app` instead of the old Vercel URL.

---

## 📋 What Needs to Be Updated

You need to update these environment variables:
- `NEXTAUTH_URL` → Change to `https://shoptofield.com/app`
- `PRODUCTION_URL` → Change to `https://shoptofield.com/app` (if it exists)
- `CAPACITOR_SERVER_URL` → Change to `https://shoptofield.com/app` (if it exists)

---

## 🎯 Step 1: Update Vercel Environment Variables (Production)

This is the most important step - your live website uses these variables.

### How to Access Vercel Dashboard:

1. **Go to Vercel Dashboard:**
   - Visit: **https://vercel.com**
   - Log in with your account

2. **Find Your Project:**
   - Look for your project in the dashboard
   - Click on the project name to open it

3. **Go to Environment Variables:**
   - Click **"Settings"** in the top menu
   - Click **"Environment Variables"** in the left sidebar

4. **Update Each Variable:**

   **For `NEXTAUTH_URL`:**
   - You may see **two entries** for `NEXTAUTH_URL` - one for Production and one for Development/Preview
   - **For Production `NEXTAUTH_URL`:**
     - Find the variable `NEXTAUTH_URL` that's set for **Production** environment
     - Click the **pencil/edit icon** (or click on the variable)
     - Change the value from `https://nextjs-auth-roles.vercel.app` to `https://shoptofield.com/app`
     - Make sure it's enabled for **Production** environment
     - Click **"Save"**
   - **For Development/Preview `NEXTAUTH_URL`:**
     - Find the variable `NEXTAUTH_URL` that's set for **Development** or **Preview** environment
     - Click the **pencil/edit icon**
     - Change the value to `https://shoptofield.com/app` (same as production)
     - Make sure it's enabled for **Preview** and **Development** environments
     - Click **"Save"**
   - **Note:** If you only see one `NEXTAUTH_URL` entry, make sure it's enabled for all environments (Production, Preview, Development, and Build)

   **For `PRODUCTION_URL` (if it exists):**
   - Find the variable `PRODUCTION_URL` in the list
   - Click the **pencil/edit icon**
   - Change the value to `https://shoptofield.com/app`
   - Make sure it's enabled for **Production**, **Preview**, and **Build** environments
   - Click **"Save"**

   **For `CAPACITOR_SERVER_URL` (if it exists):**
   - Find the variable `CAPACITOR_SERVER_URL` in the list
   - Click the **pencil/edit icon**
   - Change the value to `https://shoptofield.com/app`
   - Make sure it's enabled for **Production**, **Preview**, and **Build** environments
   - Click **"Save"**

5. **Redeploy Your Application (CRITICAL!):**
   - **Environment variables only take effect after redeployment!**
   - Go to **"Deployments"** tab
   - Find the latest deployment
   - Click **"..."** (three dots menu) → **"Redeploy"**
   - Wait for the deployment to complete (usually 2-5 minutes)
   - **OR** push a new commit to trigger automatic deployment

---

## 🖥️ Step 2: Update Local .env File (For Development)

If you have a `.env` file in your project for local development:

1. **Open the `.env` file:**
   - Navigate to your project folder
   - Open the `.env` file (if it doesn't exist, copy `ENV.EXAMPLE` to `.env`)

2. **Update the Variables:**
   ```env
   # Change this line:
   NEXTAUTH_URL=https://nextjs-auth-roles.vercel.app
   
   # To this:
   NEXTAUTH_URL=https://shoptofield.com/app
   ```

   **If you have `PRODUCTION_URL`:**
   ```env
   # Change this:
   PRODUCTION_URL=https://nextjs-auth-roles.vercel.app
   
   # To this:
   PRODUCTION_URL=https://shoptofield.com/app
   ```

   **If you have `CAPACITOR_SERVER_URL`:**
   ```env
   # Change this:
   CAPACITOR_SERVER_URL=https://nextjs-auth-roles.vercel.app
   
   # To this:
   CAPACITOR_SERVER_URL=https://shoptofield.com/app
   ```

3. **Save the file**

---

## ✅ Step 3: Verify the Changes

After updating:

1. **Check Vercel Dashboard:**
   - Go back to Environment Variables
   - Verify all values show `https://shoptofield.com/app`

2. **Test Your Application:**
   - Wait for the redeployment to complete
   - Visit `https://shoptofield.com/app`
   - Test email links (password reset, job notifications) to make sure they use the new URL

---

## 🌐 Step 4: Check/Update Domain Configuration in Vercel

**Important distinction:**
- **Domain Configuration** (Settings → Domains) = Which domain serves your app
- **Environment Variables** (Settings → Environment Variables) = What URL your app uses in emails/links

### If `shoptofield.com` is Already Configured:

1. **Check Existing Domain:**
   - Go to Vercel Dashboard → Your Project
   - Click **"Settings"** → **"Domains"**
   - Look for `shoptofield.com` in the list
   - If it's there and verified ✅, you're good! Just update environment variables (Step 1)

2. **Edit Existing Domain (if needed):**
   - If the domain exists but needs changes, click on it
   - You can edit DNS records or domain settings
   - No need to add a new domain

### If `shoptofield.com` is NOT Configured Yet:

1. **Go to Vercel Dashboard:**
   - Visit: **https://vercel.com**
   - Open your project

2. **Go to Domain Settings:**
   - Click **"Settings"** in the top menu
   - Click **"Domains"** in the left sidebar

3. **Add Your Domain:**
   - Enter `shoptofield.com` in the domain field
   - Click **"Add"** or **"Configure"**
   - Follow Vercel's instructions to add DNS records

4. **Wait for DNS Propagation:**
   - DNS changes can take up to 48 hours (usually much faster)
   - Vercel will show when the domain is verified

### About the `/app` Path:

**Important:** Vercel serves Next.js apps at the root domain. If you see `shoptofield.com/app` in your browser:
- The domain might already be configured to serve at root (`shoptofield.com`)
- The `/app` might be a path in your Next.js app, not a domain configuration
- **Just update the environment variables to match what you see in the browser**

### Quick Check:

- **If you can already access `shoptofield.com` or `shoptofield.com/app` in your browser:**
  - ✅ Domain is already configured
  - ✅ Just update environment variables (Step 1) and redeploy
  - ✅ No need to change domain settings

- **If you still see `nextjs-auth-roles.vercel.app` in your browser:**
  - You need to configure the custom domain first
  - Then update environment variables

---

## 🆘 Troubleshooting

### "I can't find the variable in Vercel"
- Some variables might not exist yet. That's okay!
- Only update the ones that exist
- The code has fallback values, so missing variables won't break anything

### "I don't have access to Vercel"
- Ask your boss or team lead for access
- Or ask them to update the variables for you

### "The URL in my browser still shows the old domain"
**This is the most common issue!** Here's what to check:

1. **Is the domain already configured?**
   - Go to Vercel → Settings → Domains
   - Check if `shoptofield.com` is already in the list
   - If YES: Domain is configured, just update environment variables (Step 1)
   - If NO: You need to add the domain first (see Step 4)

2. **Did you redeploy after updating variables?**
   - Environment variables only take effect after redeployment
   - Go to Deployments → Click "Redeploy" on the latest deployment

3. **Is the domain pointing to Vercel?**
   - Check your DNS settings
   - Make sure DNS records are configured correctly
   - Vercel will show you what DNS records to add

4. **Try clearing browser cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or clear browser cache completely

### "The changes aren't working"
- Make sure you **redeployed** after updating variables
- Check that variables are enabled for **Production** environment
- Wait a few minutes for changes to propagate
- Check Vercel deployment logs for any errors

### "I don't have a .env file"
- That's fine! The `.env` file is only for local development
- The important part is updating Vercel (Step 1)

### "I want to use /app path but Vercel serves at root"
- Vercel serves Next.js apps at the root domain (`shoptofield.com`)
- If you need `/app` path, you have options:
  1. Use a subdomain: `app.shoptofield.com`
  2. Configure a reverse proxy
  3. Use Next.js rewrites in `next.config.mjs`

---

## 📝 Quick Checklist

- [ ] Updated `NEXTAUTH_URL` in Vercel Dashboard
- [ ] Updated `PRODUCTION_URL` in Vercel Dashboard (if it exists)
- [ ] Updated `CAPACITOR_SERVER_URL` in Vercel Dashboard (if it exists)
- [ ] Made sure variables are enabled for Production, Preview, and Build
- [ ] Triggered a redeployment in Vercel
- [ ] Updated local `.env` file (if you have one)
- [ ] Tested the application to verify it works

---

## 🎉 You're Done!

Once you've updated the Vercel environment variables and redeployed, your application will use the new domain `https://shoptofield.com/app` for all links and redirects.

**Note:** The code changes have already been made. You just need to update the environment variables in Vercel and redeploy!

