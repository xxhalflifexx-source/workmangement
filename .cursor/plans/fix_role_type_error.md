# Fix Role Type Error in authOptions

## Problem
In `lib/authOptions.ts` line 174, `freshUser.role` is typed as `string` (from Prisma), but `token.role` expects the union type `"EMPLOYEE" | "MANAGER" | "ADMIN"`, causing a TypeScript compilation error.

## Solution
Add a type assertion to cast `freshUser.role` to the expected union type. Since the database schema constrains role values, this is safe.

## Changes
- **File**: `lib/authOptions.ts`
  - Line 174: Change `token.role = freshUser.role;` to `token.role = freshUser.role as "EMPLOYEE" | "MANAGER" | "ADMIN";`

This ensures TypeScript recognizes the role as the correct union type while maintaining type safety.

