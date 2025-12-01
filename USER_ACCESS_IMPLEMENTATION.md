# Per User Access Management Implementation

## Overview
This implementation adds per-user access control that sits on top of the existing role-based system. Admins can now control dashboard visibility and access for each individual user, overriding role-based permissions.

## Database Schema

### New Table: `UserAccessOverride`
```prisma
model UserAccessOverride {
  id            String   @id @default(cuid())
  userId        String
  componentName String   // e.g., "jobs", "qc", "finance", "hr", "inventory", "materials", "time-clock"
  access        String   @default("allowed") // "allowed" or "not_allowed"
  notes         String?
  updatedAt     DateTime @updatedAt
  createdAt     DateTime @default(now())
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, componentName])
  @@index([userId])
  @@index([componentName])
}
```

**Migration Required:**
Run `npx prisma migrate dev` to create the new table.

## Components Created

### 1. Server Actions (`app/admin/user-access-actions.ts`)
- `getUserAccessOverrides()` - Get all access overrides (Admin only)
- `getAllUsersWithAccess()` - Get all users (Admin only)
- `updateUserAccess()` - Update/create access override (Admin only)
- `deleteUserAccess()` - Delete access override (Admin only)

### 2. Access Utility (`lib/user-access.ts`)
- `checkUserAccess()` - Check if user has access to a component
- `getUserAccessibleComponents()` - Get all components user can access

### 3. User Access Tab (`app/admin/UserAccessTab.tsx`)
- Table UI showing all users and their access to each component
- Dropdown to set "Allowed", "Not Allowed", or "Default (Role-based)"
- Real-time updates with success/error messages

### 4. Access Check Component (`components/CheckAccess.tsx`)
- Client component that wraps pages to check access
- Shows loading state while checking
- Shows AccessDenied if user doesn't have access

### 5. Access Denied Component (`components/AccessDenied.tsx`)
- User-friendly error page shown when access is blocked
- Message: "Access blocked. Please contact your administrator."

### 6. Dashboard Links (`app/dashboard/DashboardLinks.tsx`)
- Dynamically loads and displays only accessible components
- Hides restricted components from dashboard

### 7. API Routes
- `/api/check-access` - Check if user has access to a component
- `/api/user-accessible-components` - Get all components user can access

## Admin Panel Integration

### New Tab: "User Access"
- Location: Dashboard → Administrative Panel → User Access
- Only visible to Admin users
- Table shows:
  - User (name + email)
  - Role (Admin/Manager/Employee)
  - Component/Page columns (Job Management, QC, Finance, HR, Inventory, Materials, Time Clock)
  - Access dropdown (Allowed/Not Allowed/Default)
  - Notes field (optional)

## Access Enforcement

### 1. Dashboard Links
- `DashboardLinks` component checks access before showing links
- Only accessible components appear on dashboard

### 2. Direct URL Navigation
- Pages should be wrapped with `CheckAccess` component
- Example:
```tsx
import CheckAccess from "@/components/CheckAccess";

export default function JobsPage() {
  return (
    <CheckAccess componentName="jobs">
      {/* Page content */}
    </CheckAccess>
  );
}
```

### 3. Pages That Need Wrapping
The following pages should be wrapped with `CheckAccess`:
- `/jobs` - componentName: "jobs"
- `/qc` - componentName: "qc"
- `/finance` - componentName: "finance"
- `/hr` - componentName: "hr"
- `/inventory` - componentName: "inventory"
- `/material-requests` - componentName: "materials"
- `/time-clock` - componentName: "time-clock"

## Access Logic

1. **Admin users** always have access to everything (cannot be restricted)
2. **User-specific overrides** take precedence over role-based access
3. **Role-based access** is used as fallback if no override exists
4. **Default role-based access:**
   - `jobs`: ADMIN, MANAGER, EMPLOYEE
   - `time-clock`: ADMIN, MANAGER, EMPLOYEE
   - `qc`: ADMIN, MANAGER
   - `finance`: ADMIN, MANAGER
   - `hr`: ADMIN, MANAGER
   - `inventory`: ADMIN, MANAGER
   - `materials`: ADMIN, MANAGER, EMPLOYEE

## Usage Instructions

### For Admins:

1. Navigate to: Dashboard → Administrative Panel → User Access
2. Find the user you want to restrict
3. Select "Not Allowed" for the component you want to block
4. Changes are saved immediately
5. User will no longer see that component in dashboard
6. If user tries to access directly via URL, they'll see "Access blocked" message

### To Remove Restriction:
1. Set access back to "Default (Role-based)" or "Allowed"
2. User will regain access based on role

## Security

- Only Admin users can:
  - View the User Access tab
  - Modify user access settings
  - See all access overrides
- All server actions check for Admin role
- Access checks are performed server-side
- Client-side checks are for UX only

## Next Steps (To Complete Implementation)

1. **Wrap pages with CheckAccess:**
   - Update each page component to use `CheckAccess` wrapper
   - Example for `/app/jobs/page.tsx`:
   ```tsx
   import CheckAccess from "@/components/CheckAccess";
   
   export default function JobsPage() {
     return (
       <CheckAccess componentName="jobs">
         {/* Existing page content */}
       </CheckAccess>
     );
   }
   ```

2. **Run Database Migration:**
   ```bash
   npx prisma migrate dev --name add_user_access_overrides
   ```

3. **Test Access Control:**
   - Create a test user
   - As admin, restrict access to a component
   - Verify component doesn't appear in dashboard
   - Verify direct URL access shows "Access blocked"

## Files Modified/Created

### Created:
- `app/admin/user-access-actions.ts`
- `app/admin/UserAccessTab.tsx`
- `lib/user-access.ts`
- `components/CheckAccess.tsx`
- `components/AccessDenied.tsx`
- `app/dashboard/DashboardLinks.tsx`
- `app/api/check-access/route.ts`
- `app/api/user-accessible-components/route.ts`
- `prisma/migrations/add_user_access_overrides/migration.sql`

### Modified:
- `prisma/schema.prisma` - Added UserAccessOverride model
- `app/admin/page.tsx` - Added User Access tab
- `app/dashboard/page.tsx` - Replaced hardcoded links with DashboardLinks component

## Notes

- This system sits ON TOP of existing role-based access
- Does not modify authentication flow
- Does not change login roles
- Does not affect admin access rules
- Button visibility and actions are preserved
- All existing functionality remains intact

