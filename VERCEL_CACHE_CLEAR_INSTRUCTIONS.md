# How to Clear Vercel Build Cache

## Quick Fix for Build Error

The "Unexpected token `main`" error is likely due to Vercel's build cache. Here's how to clear it:

### Steps:
1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project: `workmangement`
3. Go to the **Deployments** tab
4. Find the latest deployment (or any deployment)
5. Click the **"..."** (three dots) menu on the deployment
6. Select **"Redeploy"**
7. **IMPORTANT**: Check the box **"Use existing Build Cache"** and UNCHECK it (or look for "Clear Cache" option)
8. Click **"Redeploy"**

### Alternative Method:
- In Vercel dashboard → Settings → General
- Look for "Clear Build Cache" option
- Or use Vercel CLI: `vercel --force`

## File Encoding Check

Ensure `app/inventory/page.tsx` is UTF-8:
- In VS Code: Check bottom-right corner for encoding
- Should show "UTF-8" (not "UTF-8 with BOM")
- If wrong: Click encoding → "Save with Encoding" → "UTF-8"

## Component Splitting Progress

✅ Completed:
- Extracted types to `app/inventory/types.ts`
- Updated imports

⏳ Still Needed (to reduce file from ~1911 to ~500 lines):
- Extract Inventory tab content (lines 672-974)
- Extract Materials Requested tab content (lines 977-1544)
- Extract 4 modals (lines 1548+)

## Next Steps After Cache Clear

If clearing cache doesn't work:
1. Continue component splitting
2. Or try updating Next.js to latest 14.x version
3. Or check for hidden characters in the file

