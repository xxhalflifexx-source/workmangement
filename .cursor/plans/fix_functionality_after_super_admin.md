# Fix Functionality After Super Admin Implementation

## Problem
Recent super admin implementation has broken existing functionality:
1. **Company logo missing** - Dashboard is fetching company settings without organization filter
2. **Admin access issues** - Admin accounts may not be able to access admin pages due to organization context issues
3. **Multi-tenant compatibility** - Some queries don't properly filter by organizationId

## Root Causes
1. Dashboard (`app/dashboard/page.tsx`) directly queries `prisma.companySettings.findFirst()` without organization filter
2. `getCompanySettings()` requires ADMIN role but may fail for users without proper organization context
3. Some queries don't account for super admins who may not have an organizationId

## Solution
1. Fix dashboard logo fetching to use organization-aware query
2. Ensure admin access works regardless of organization context
3. Make company settings queries work for both regular users and super admins
4. Ensure all existing functionality maintains backward compatibility

## Changes

### File: `app/dashboard/page.tsx`
- Replace direct Prisma query with organization-aware query
- Use `getOrgContext()` or fetch user's organizationId from session
- Filter company settings by organizationId, or allow super admins to see any

### File: `app/admin/actions.ts`
- Ensure `getCompanySettings()` works for super admins (who may have null organizationId)
- Allow super admins to access company settings

### File: `lib/org-utils.ts`
- Ensure `getOrgContext()` properly handles all user types including super admins

### Verification
- Test logo display on dashboard
- Test admin page access
- Test company settings access for regular admins and super admins
- Ensure backward compatibility with existing data

