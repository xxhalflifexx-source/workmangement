# Registration Codes

The registration system includes role-based registration codes that determine the user's role during signup.

## 🔑 Registration Codes

| Code | Role | Description |
|------|------|-------------|
| **sunrise** | EMPLOYEE | Standard employee access |
| **sunset** | MANAGER | Manager-level access |
| **moonlight** | ADMIN | Full administrative access |

## 📝 How It Works

1. During registration, users can optionally enter a **Registration Code**
2. The code is case-insensitive (e.g., "Sunrise", "SUNRISE", "sunrise" all work)
3. If a valid code is entered, the user is assigned the corresponding role
4. If no code is entered or an invalid code is provided, the user defaults to **EMPLOYEE** role

## 🎯 Usage

### For Standard Employees
- Leave the "Registration Code" field empty, OR
- Enter: `sunrise`

### For Managers
- Enter: `sunset`

### For Administrators
- Enter: `moonlight`

## 🔐 Security Notes

- Registration codes are processed server-side
- Codes are trimmed and converted to lowercase before validation
- Invalid codes are silently ignored (user gets EMPLOYEE role)
- Codes are defined in: `app/(auth)/actions.ts`

## 🛠️ Customization

To change or add registration codes, edit `app/(auth)/actions.ts`:

```typescript
const ROLE_CODES = {
  sunrise: "EMPLOYEE",    // Change "sunrise" to your preferred code
  sunset: "MANAGER",      // Change "sunset" to your preferred code
  moonlight: "ADMIN",     // Change "moonlight" to your preferred code
  // Add more codes here:
  // yourcode: "ADMIN",
} as const;
```

## 📋 Testing

### Test Registration with Different Roles:

1. **Employee Account**
   - Name: John Doe
   - Email: john@example.com
   - Password: password123
   - Registration Code: `sunrise` (or leave empty)
   - Result: EMPLOYEE role

2. **Manager Account**
   - Name: Jane Smith
   - Email: jane@example.com
   - Password: password123
   - Registration Code: `sunset`
   - Result: MANAGER role

3. **Admin Account**
   - Name: Admin User
   - Email: admin2@example.com
   - Password: password123
   - Registration Code: `moonlight`
   - Result: ADMIN role

## 🎨 UI Display

The registration page displays a helpful info box showing all available codes:

```
Role Codes:
• sunrise → Employee
• sunset → Manager
• moonlight → Admin

Leave empty for Employee role
```

## 🔄 Alternative Approach

For production applications, consider these alternatives:

1. **Invite-only Registration**: Generate unique invite codes per user
2. **Admin-managed Users**: Only admins can create users with specific roles
3. **Email Domain-based**: Assign roles based on email domain
4. **Two-step Registration**: Users register as employees, admins promote them

## 📚 Related Files

- `app/(auth)/actions.ts` - Server action with role code logic
- `app/register/page.tsx` - Registration form with code input
- `prisma/schema.prisma` - User model with role field

## ✅ Current Implementation

- ✅ Case-insensitive matching
- ✅ Automatic whitespace trimming
- ✅ Default to EMPLOYEE for invalid/empty codes
- ✅ Server-side validation
- ✅ Visual helper on registration form
- ✅ Optional field (not required)



