# Changelog

## [Latest] - Registration Code System Added

### ✨ New Features

#### Registration Codes for Role Assignment

Users can now specify their role during registration using special codes:

- **`sunrise`** → EMPLOYEE role
- **`sunset`** → MANAGER role  
- **`moonlight`** → ADMIN role

### 📝 Changes Made

#### 1. Updated Server Action (`app/(auth)/actions.ts`)
- Added `registrationCode` field to validation schema
- Implemented `ROLE_CODES` mapping object
- Added logic to check registration code and assign appropriate role
- Case-insensitive matching with automatic trimming
- Defaults to EMPLOYEE for invalid/empty codes

```typescript
const ROLE_CODES = {
  sunrise: "EMPLOYEE",
  sunset: "MANAGER",
  moonlight: "ADMIN",
} as const;
```

#### 2. Updated Registration Page (`app/register/page.tsx`)
- Added "Registration Code" input field (optional)
- Added helpful info box showing available codes
- Styled with Tailwind CSS for clear visibility
- Maintains responsive design

### 🎯 How to Use

#### Register as Employee (2 ways):
1. Leave "Registration Code" field empty
2. Enter: `sunrise`

#### Register as Manager:
- Enter: `sunset`

#### Register as Admin:
- Enter: `moonlight`

### 🔒 Security Features

- ✅ Server-side validation
- ✅ Case-insensitive matching
- ✅ Whitespace trimming
- ✅ Invalid codes fail gracefully (default to EMPLOYEE)
- ✅ Optional field (backward compatible)

### 📚 Documentation Added

1. **REGISTRATION_CODES.md** - Complete guide to registration codes
2. **QUICK_REFERENCE.txt** - Quick reference card with codes
3. **CHANGELOG.md** - This file

### 🧪 Testing

Visit http://localhost:3000/register to test the new feature:

1. **Test Employee Registration**
   ```
   Name: Test Employee
   Email: test1@example.com
   Password: password123
   Registration Code: sunrise (or leave empty)
   ```

2. **Test Manager Registration**
   ```
   Name: Test Manager
   Email: test2@example.com
   Password: password123
   Registration Code: sunset
   ```

3. **Test Admin Registration**
   ```
   Name: Test Admin
   Email: test3@example.com
   Password: password123
   Registration Code: moonlight
   ```

After registration, log in and check the dashboard to verify the correct role was assigned.

### 🎨 UI Changes

The registration form now displays:
- New "Registration Code (optional)" input field
- Info box with available codes:
  ```
  Role Codes:
  • sunrise → Employee
  • sunset → Manager
  • moonlight → Admin
  
  Leave empty for Employee role
  ```

### ⚡ Performance

- No performance impact
- Server-side validation is fast
- Hot-reloading works with changes

### 🔄 Backward Compatibility

- ✅ Existing functionality unchanged
- ✅ Empty code defaults to EMPLOYEE (original behavior)
- ✅ All existing test accounts still work
- ✅ Login flow unchanged

### 📁 Files Modified

```
app/(auth)/actions.ts        (Updated with registration code logic)
app/register/page.tsx        (Added registration code input field)
```

### 📁 Files Created

```
REGISTRATION_CODES.md        (Complete guide)
QUICK_REFERENCE.txt          (Quick reference card)
CHANGELOG.md                 (This file)
```

---

## [Initial] - Project Setup

### ✨ Features Implemented

- NextAuth.js authentication with Credentials provider
- Email + Password login
- User registration
- Role-based access control (EMPLOYEE, MANAGER, ADMIN)
- Protected routes with middleware
- Prisma + SQLite database
- bcrypt password hashing
- TypeScript type safety
- Tailwind CSS styling
- Seed script with test users

### 📚 Documentation Created

- README.md
- SETUP.md
- PROJECT_OVERVIEW.md
- SETUP_COMPLETE.txt
- INSTALL_NODEJS_FIRST.txt

### 🧪 Test Accounts

- admin@example.com / Passw0rd! (ADMIN)
- manager@example.com / Passw0rd! (MANAGER)
- employee@example.com / Passw0rd! (EMPLOYEE)



