# Remove Manual Module and Make User Access Control Real-Time

## Problem
1. The "manual" module still appears in User Access Control even though it was deleted long ago
2. Permission updates require a full reload - not real-time

## Solution
1. Remove "manual" from all module lists and type definitions
2. Update the UI immediately after save without reloading all users
3. Sync the saved permissions back to the user object in state

## Changes

### File: `lib/permissions.ts`
- Remove "manual" from `ModulePermission` type
- Remove `manual?: boolean` from `UserPermissions` interface
- Remove `manual: true` from `DEFAULT_PERMISSIONS`
- Remove `manual: ["/manual"]` from `MODULE_ROUTES`
- Remove `manual: "Manual"` from `getModuleNames()` return

### File: `app/admin/user-access/page.tsx`
- Remove `{ key: "manual", label: "Manual" }` from modules array (line 42)
- Update `handleSave` to update local state immediately after successful save instead of reloading
- Update the user's permissions in the `users` state to reflect saved changes

### File: `app/admin/UserAccessControlContent.tsx`
- Remove `"manual"` from modules array (line 45)

### File: `app/admin/page.tsx`
- Update the onSave handler to update local state immediately instead of reloading

## Real-Time Update Strategy
After a successful save:
1. Update the user's permissions in the `users` state array
2. Update the `permissions` state to match the saved permissions
3. Show success message
4. Do NOT reload all users (removes the need for full refresh)

This makes changes appear instantly without waiting for a database round-trip reload.

