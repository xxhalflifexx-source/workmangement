# Authentication Token Storage & Session Persistence

## ✅ Implementation Summary

This document describes how authentication tokens are securely stored and persist across page refreshes, new browser tabs, and browser reopens.

---

## 🔐 1. Token Storage

### httpOnly Cookies (Secure Storage)

Authentication tokens are stored in **httpOnly cookies** via NextAuth.js. This is the most secure method because:

- ✅ **httpOnly**: JavaScript cannot access the cookie (prevents XSS attacks)
- ✅ **Secure**: Only sent over HTTPS in production
- ✅ **SameSite**: CSRF protection
- ✅ **Automatic**: Browser handles cookie persistence

### Configuration

**File: `lib/authOptions.ts`**

```typescript
cookies: {
  sessionToken: {
    name: `next-auth.session-token`,
    options: {
      httpOnly: true, // Prevents JavaScript access - secure storage
      sameSite: "lax", // CSRF protection
      path: "/",
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      maxAge: 30 * 24 * 60 * 60, // 30 days - matches session maxAge
    },
  },
  // ... other cookies
}
```

### Token Persistence

Tokens persist on:
- ✅ **Page refresh**: Cookie is automatically sent with each request
- ✅ **New browser tab**: Same domain = same cookies = same session
- ✅ **Browser reopen**: Cookies persist based on browser settings (if allowed)

---

## 🔄 2. Session Initialization

### Global Session Initialization Function

**File: `lib/session-init.ts`**

```typescript
export async function initializeSession(): Promise<SessionInitResult> {
  // Checks for valid token
  // Fetches current user
  // Restores authentication state
}
```

### Automatic Initialization

**File: `components/SessionInitializer.tsx`**

A React component that automatically initializes sessions on:
- Page load
- New tab open
- Browser reopen

**File: `app/providers.tsx`**

The `SessionInitializer` component is included in the root layout, ensuring it runs on every page.

---

## 🚫 3. Prevent Auto-Logout

### ✅ No Auto-Logout Code

**Verified:** No code exists that:
- ❌ Clears session on `visibilitychange`
- ❌ Resets auth state on new tab
- ❌ Overwrites token on page load

### Session Provider Configuration

**File: `app/providers.tsx`**

```typescript
<SessionProvider
  refetchInterval={5 * 60} // Refetch every 5 minutes (does NOT clear)
  refetchOnWindowFocus={true} // Refetch on focus (does NOT clear)
>
```

**Important:** `refetchOnWindowFocus` and `refetchInterval` **DO NOT** clear sessions. They only refresh the session data if the token is still valid.

---

## 📋 4. Session Lifecycle

### Login Flow

1. User submits credentials
2. NextAuth validates credentials
3. JWT token created and stored in httpOnly cookie
4. Session cookie sent to browser
5. Cookie persists for 30 days

### Page Load Flow

1. Browser sends session cookie automatically
2. `SessionInitializer` component mounts
3. `initializeSession()` checks for valid token
4. If valid: Session restored, user stays logged in
5. If invalid/expired: User redirected to login

### Cross-Tab Synchronization

**File: `lib/session-sync.ts`**

- Uses `localStorage` events (not for token storage, only for sync)
- Broadcasts sign-in/sign-out events across tabs
- Updates session state without clearing tokens

---

## 🔒 5. Security Features

### Token Security

- ✅ **httpOnly**: Cannot be accessed by JavaScript
- ✅ **Secure**: HTTPS only in production
- ✅ **SameSite**: CSRF protection
- ✅ **MaxAge**: 30 days (configurable)

### Session Validation

- ✅ Token signature verified on every request
- ✅ Token expiration checked automatically
- ✅ Invalid tokens rejected (user logged out)

---

## 🧪 6. Testing Session Persistence

### Test Page Refresh

1. Log in
2. Refresh page (F5)
3. ✅ Should remain logged in

### Test New Tab

1. Log in
2. Open new tab to same domain
3. ✅ Should be logged in automatically

### Test Browser Reopen

1. Log in
2. Close browser completely
3. Reopen browser
4. Navigate to site
5. ✅ Should be logged in (if browser allows cookie persistence)

---

## 📝 7. Files Modified/Created

### Modified Files

- `lib/authOptions.ts` - Added explicit cookie configuration
- `app/providers.tsx` - Added SessionInitializer component

### New Files

- `lib/session-init.ts` - Global session initialization utility
- `components/SessionInitializer.tsx` - React component for auto-initialization
- `AUTHENTICATION_PERSISTENCE.md` - This documentation

---

## 🎯 8. Key Points

1. **Tokens are stored in httpOnly cookies** - Most secure method
2. **Sessions persist automatically** - No code needed to maintain persistence
3. **No auto-logout code exists** - Sessions only expire after 30 days or explicit logout
4. **Session initialization is automatic** - Happens on every page load
5. **Cross-tab sync works** - Uses localStorage events (not for token storage)

---

## ⚠️ 9. Important Notes

### Cookie Persistence

- Cookies persist based on browser settings
- Some browsers may clear cookies on close (user setting)
- Private/Incognito mode: Cookies cleared on window close
- Browser extensions can affect cookie behavior

### Session Expiration

- Sessions expire after 30 days of inactivity
- Token is refreshed daily (updateAge: 24 hours)
- Expired tokens automatically log user out

### Development vs Production

- **Development**: Cookies work over HTTP (secure: false)
- **Production**: Cookies require HTTPS (secure: true)

---

## ✅ Summary

✅ **Token Storage**: httpOnly cookies (secure, automatic)  
✅ **Session Initialization**: Global function + automatic component  
✅ **Persistence**: Works across refresh, new tabs, browser reopen  
✅ **No Auto-Logout**: Verified - no code clears sessions  
✅ **Security**: httpOnly, Secure, SameSite protection  

The authentication system is now fully configured for secure, persistent sessions.

