# Step-by-Step Implementation Guide

## Step 1: Run Database Migration

**Open:** Terminal/Command Prompt  
**Location:** Project root: `C:\Users\King\Documents\GitHub\workmangement`

**Run:**
```bash
npx prisma migrate dev --name add_user_access_overrides
```

**Expected Output:**
- Migration created successfully
- Database updated

---

## Step 2: Wrap Pages with CheckAccess

### File 1: Jobs Page
**Location:** `app/jobs/page.tsx`

**Line ~3040:** Find `export default function JobsPage()`

**Add import at top (around line 1-15):**
```tsx
import CheckAccess from "@/components/CheckAccess";
```

**Modify the export (around line 3040):**
```tsx
export default function JobsPage() {
  return (
    <CheckAccess componentName="jobs">
      <Suspense fallback={
        <main className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </main>
      }>
        <JobsPageContent />
      </Suspense>
    </CheckAccess>
  );
}
```

---

### File 2: QC Page (Server Component - Different Approach)
**Location:** `app/qc/page.tsx`

**This is a server component, so we need a client wrapper:**

**Create new file:** `app/qc/QCPageClient.tsx`
```tsx
"use client";

import CheckAccess from "@/components/CheckAccess";
import { ReactNode } from "react";

export default function QCPageClient({ children }: { children: ReactNode }) {
  return (
    <CheckAccess componentName="qc">
      {children}
    </CheckAccess>
  );
}
```

**Then modify:** `app/qc/page.tsx`
**Add import:**
```tsx
import QCPageClient from "./QCPageClient";
```

**Wrap the return statement:**
```tsx
export default async function QCPage({ searchParams }: {...}) {
  // ... existing code ...
  
  return (
    <QCPageClient>
      <main className="min-h-screen bg-gray-50">
        {/* All existing content */}
      </main>
    </QCPageClient>
  );
}
```

---

### File 3: Finance Page
**Location:** `app/finance/page.tsx`

**Line ~1:** Add import:
```tsx
import CheckAccess from "@/components/CheckAccess";
```

**Find the export default function (around line 30-50):**
```tsx
export default function FinancePage() {
```

**Wrap the return:**
```tsx
export default function FinancePage() {
  return (
    <CheckAccess componentName="finance">
      {/* All existing return content */}
    </CheckAccess>
  );
}
```

---

### File 4: HR Page
**Location:** `app/hr/page.tsx`

**Line ~1:** Add import:
```tsx
import CheckAccess from "@/components/CheckAccess";
```

**Find:** `export default function HRPage()`

**Wrap the return:**
```tsx
export default function HRPage() {
  return (
    <CheckAccess componentName="hr">
      {/* All existing return content */}
    </CheckAccess>
  );
}
```

---

### File 5: Inventory Page
**Location:** `app/inventory/page.tsx`

**Line ~1:** Add import:
```tsx
import CheckAccess from "@/components/CheckAccess";
```

**Find:** `export default function InventoryPage()`

**Wrap the return:**
```tsx
export default function InventoryPage() {
  return (
    <CheckAccess componentName="inventory">
      {/* All existing return content */}
    </CheckAccess>
  );
}
```

---

### File 6: Time Clock Page
**Location:** `app/time-clock/page.tsx`

**Line ~1:** Add import:
```tsx
import CheckAccess from "@/components/CheckAccess";
```

**Find:** `export default function TimeClockPage()`

**Wrap the return:**
```tsx
export default function TimeClockPage() {
  return (
    <CheckAccess componentName="time-clock">
      {/* All existing return content */}
    </CheckAccess>
  );
}
```

---

### File 7: Material Requests Page
**Location:** Check if exists at `app/material-requests/page.tsx` or similar

**If it exists, add:**
```tsx
import CheckAccess from "@/components/CheckAccess";

export default function MaterialRequestsPage() {
  return (
    <CheckAccess componentName="materials">
      {/* Existing content */}
    </CheckAccess>
  );
}
```

---

## Step 3: Test the Implementation

### Test 1: Verify Migration
1. Open your database tool (Supabase dashboard, pgAdmin, etc.)
2. Check if `UserAccessOverride` table exists
3. Verify it has the correct columns

### Test 2: Access User Access Tab
1. Login as Admin
2. Go to: Dashboard → Administrative Panel
3. Click "User Access" tab
4. Verify table loads with users and components

### Test 3: Restrict Access
1. In User Access tab, find a test user
2. Set "Jobs" to "Not Allowed"
3. Logout and login as that user
4. Verify:
   - Jobs card doesn't appear on dashboard
   - Direct URL `/jobs` shows "Access blocked" message

### Test 4: Restore Access
1. Login as Admin
2. Set access back to "Allowed" or "Default"
3. User should regain access

---

## Quick Checklist

- [ ] Run database migration
- [ ] Wrap `app/jobs/page.tsx` with CheckAccess
- [ ] Wrap `app/qc/page.tsx` with QCPageClient wrapper
- [ ] Wrap `app/finance/page.tsx` with CheckAccess
- [ ] Wrap `app/hr/page.tsx` with CheckAccess
- [ ] Wrap `app/inventory/page.tsx` with CheckAccess
- [ ] Wrap `app/time-clock/page.tsx` with CheckAccess
- [ ] Wrap material requests page (if exists) with CheckAccess
- [ ] Test as admin
- [ ] Test access restriction
- [ ] Test access restoration

---

## Notes

- **QC Page** is special because it's a server component. Use the client wrapper approach.
- **Component names** must match exactly (case-sensitive): "jobs", "qc", "finance", "hr", "inventory", "materials", "time-clock"
- **Admins** always have access (cannot be restricted)
- **Default** means use role-based access (existing system)

