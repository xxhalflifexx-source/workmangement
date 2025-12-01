# Next Steps: User Access Implementation

## Step 1: Run Database Migration

**Location:** Terminal/Command Prompt in your project root

**Command:**
```bash
npx prisma migrate dev --name add_user_access_overrides
```

**What it does:**
- Creates the `UserAccessOverride` table in your database
- Applies the migration to your database

**After running:**
- You should see a success message
- The table will be created in your database

---

## Step 2: Wrap Pages with CheckAccess Component

You need to wrap each protected page with the `CheckAccess` component. Here are the specific files to modify:

### 2.1 Jobs Page
**File:** `app/jobs/page.tsx`

**Find:** The main export function (around line 94)
**Add at the top:**
```tsx
import CheckAccess from "@/components/CheckAccess";
```

**Wrap the return statement:**
```tsx
export default function JobsPage() {
  return (
    <CheckAccess componentName="jobs">
      {/* Existing JobsPageContent or page content */}
    </CheckAccess>
  );
}
```

**Note:** Since this page uses Suspense, you might need to wrap the inner component:
```tsx
export default function JobsPage() {
  return (
    <CheckAccess componentName="jobs">
      <Suspense fallback={<div>Loading...</div>}>
        <JobsPageContent />
      </Suspense>
    </CheckAccess>
  );
}
```

---

### 2.2 Quality Control Page
**File:** `app/qc/page.tsx`

**Add import:**
```tsx
import CheckAccess from "@/components/CheckAccess";
```

**Wrap the page:**
```tsx
export default function QCPage() {
  return (
    <CheckAccess componentName="qc">
      {/* Existing page content */}
    </CheckAccess>
  );
}
```

---

### 2.3 Finance Page
**File:** `app/finance/page.tsx`

**Add import:**
```tsx
import CheckAccess from "@/components/CheckAccess";
```

**Wrap the page:**
```tsx
export default function FinancePage() {
  return (
    <CheckAccess componentName="finance">
      {/* Existing page content */}
    </CheckAccess>
  );
}
```

---

### 2.4 HR Page
**File:** `app/hr/page.tsx`

**Add import:**
```tsx
import CheckAccess from "@/components/CheckAccess";
```

**Wrap the page:**
```tsx
export default function HRPage() {
  return (
    <CheckAccess componentName="hr">
      {/* Existing page content */}
    </CheckAccess>
  );
}
```

---

### 2.5 Inventory Page
**File:** `app/inventory/page.tsx`

**Add import:**
```tsx
import CheckAccess from "@/components/CheckAccess";
```

**Wrap the page:**
```tsx
export default function InventoryPage() {
  return (
    <CheckAccess componentName="inventory">
      {/* Existing page content */}
    </CheckAccess>
  );
}
```

---

### 2.6 Materials Requested Page
**File:** `app/material-requests/page.tsx`

**Add import:**
```tsx
import CheckAccess from "@/components/CheckAccess";
```

**Wrap the page:**
```tsx
export default function MaterialRequestsPage() {
  return (
    <CheckAccess componentName="materials">
      {/* Existing page content */}
    </CheckAccess>
  );
}
```

---

### 2.7 Time Clock Page
**File:** `app/time-clock/page.tsx`

**Add import:**
```tsx
import CheckAccess from "@/components/CheckAccess";
```

**Wrap the page:**
```tsx
export default function TimeClockPage() {
  return (
    <CheckAccess componentName="time-clock">
      {/* Existing page content */}
    </CheckAccess>
  );
}
```

---

## Step 3: Testing

### 3.1 Test as Admin

1. **Login as Admin**
2. **Navigate to:** Dashboard → Administrative Panel → User Access
3. **Verify:** You can see the User Access tab
4. **Verify:** Table shows all users and components

### 3.2 Test Access Restriction

1. **As Admin:**
   - Go to User Access tab
   - Find a test user (or create one)
   - Set "Jobs" to "Not Allowed" for that user
   - Save

2. **Logout and login as that test user:**
   - Verify "Jobs" card does NOT appear on dashboard
   - Try to access `/jobs` directly via URL
   - Verify you see "Access blocked. Please contact your administrator."

3. **As Admin again:**
   - Set access back to "Allowed" or "Default"
   - User should regain access

### 3.3 Test Role-Based Fallback

1. **As Admin:**
   - Set a user's access to "Default (Role-based)"
   - Verify user gets access based on their role
   - Employees: jobs, time-clock, materials
   - Managers: jobs, time-clock, materials, qc, finance, hr, inventory

---

## Quick Reference: Component Names

When wrapping pages, use these exact component names:

| Page | Component Name |
|------|---------------|
| `/jobs` | `"jobs"` |
| `/qc` | `"qc"` |
| `/finance` | `"finance"` |
| `/hr` | `"hr"` |
| `/inventory` | `"inventory"` |
| `/material-requests` | `"materials"` |
| `/time-clock` | `"time-clock"` |

---

## Troubleshooting

### Migration Fails
- Check database connection
- Ensure Prisma is up to date: `npx prisma generate`
- Check if table already exists

### CheckAccess Not Working
- Verify import path: `@/components/CheckAccess`
- Check component name matches exactly (case-sensitive)
- Check browser console for errors
- Verify API route `/api/check-access` is accessible

### Access Not Updating
- Clear browser cache
- Check database for UserAccessOverride records
- Verify user ID matches in database

---

## Files to Modify Summary

1. ✅ `prisma/schema.prisma` - Already done
2. ✅ `app/admin/page.tsx` - Already done
3. ✅ `app/dashboard/page.tsx` - Already done
4. ⏳ `app/jobs/page.tsx` - **TODO: Add CheckAccess wrapper**
5. ⏳ `app/qc/page.tsx` - **TODO: Add CheckAccess wrapper**
6. ⏳ `app/finance/page.tsx` - **TODO: Add CheckAccess wrapper**
7. ⏳ `app/hr/page.tsx` - **TODO: Add CheckAccess wrapper**
8. ⏳ `app/inventory/page.tsx` - **TODO: Add CheckAccess wrapper**
9. ⏳ `app/material-requests/page.tsx` - **TODO: Add CheckAccess wrapper**
10. ⏳ `app/time-clock/page.tsx` - **TODO: Add CheckAccess wrapper**

---

## Example: Complete Page Wrapper

Here's a complete example for reference:

```tsx
"use client";

import CheckAccess from "@/components/CheckAccess";
// ... other imports

export default function ExamplePage() {
  return (
    <CheckAccess componentName="jobs">
      <main className="min-h-screen bg-gray-50">
        {/* Your existing page content */}
      </main>
    </CheckAccess>
  );
}
```

---

## After Completion

Once all pages are wrapped:
1. ✅ Run migration
2. ✅ All pages wrapped with CheckAccess
3. ✅ Test access restrictions
4. ✅ System is fully functional!

The system will now:
- Hide restricted components from dashboard
- Block direct URL access to restricted pages
- Show "Access blocked" message when needed
- Allow admins to manage per-user access

