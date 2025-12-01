# Multi-Tab Session Synchronization

## ✅ Implementation Summary

This document describes how authentication sessions persist across multiple browser tabs and synchronize seamlessly.

---

## 🔐 1. Session Persistence Across Tabs

### Token Storage Strategy

**Primary Storage: httpOnly Cookies**
- ✅ Tokens stored in **httpOnly cookies** (most secure)
- ✅ Cookies automatically shared across all tabs on the same domain
- ✅ Not accessible via JavaScript (prevents XSS attacks)
- ✅ Persists across page refreshes, new tabs, and browser reopens

**Secondary Storage: localStorage Indicator**
- ✅ Session indicator stored in **localStorage** (for cross-tab sync)
- ✅ Contains user ID and email (not the token itself)
- ✅ Used to detect login state across tabs
- ✅ Automatically synced when login/logout occurs

### Configuration

**File: `lib/authOptions.ts`**

```typescript
cookies: {
  sessionToken: {
    name: `next-auth.session-token`,
    options: {
      httpOnly: true,    // ✅ Prevents JavaScript access
      sameSite: "lax",  // ✅ CSRF protection
      secure: true,     // ✅ HTTPS only in production
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
  },
}
```

**Token Management:**
- ✅ **SameSite=Lax**: CSRF protection
- ✅ **Secure=true**: HTTPS only in production
- ✅ **HttpOnly=true**: Prevents JavaScript access
- ✅ **Expiration**: 30 days (configurable)

---

## 🔄 2. Multi-Tab Sync

### Event Listener System

**File: `lib/session-sync.ts`**

The system uses `localStorage` events to synchronize login state across tabs:

1. **When login occurs in any tab:**
   - Token stored in httpOnly cookie (automatic)
   - Session indicator stored in localStorage
   - `storage` event broadcast to all other tabs
   - Other tabs detect event and restore session

2. **When logout occurs in any tab:**
   - Token cleared from httpOnly cookie (automatic)
   - Session indicator removed from localStorage
   - `storage` event broadcast to all other tabs
   - Other tabs detect event and sync logout state

### Implementation

```typescript
// Broadcast login event
broadcastSessionEvent("signin", userId, email);

// Listen for events from other tabs
setupSessionSync(
  () => update(), // Another tab signed in - restore session
  () => update(), // Another tab signed out - sync state
  () => update()  // Session updated - refresh
);
```

### Automatic Session Restoration

**File: `app/providers.tsx`**

- Checks for session indicator on mount
- If indicator exists but no session, automatically restores
- No manual intervention required

---

## 🚫 3. Prevent Forced Logout

### ✅ Verified: No Forced Logout Code

**No code exists that:**
- ❌ Logs out other tabs on new login
- ❌ Clears tokens on tab switch
- ❌ Refreshes or redirects to login unnecessarily

### Session Provider Configuration

**File: `app/providers.tsx`**

```typescript
<SessionProvider
  refetchInterval={5 * 60}        // Refetch every 5 min (does NOT clear)
  refetchOnWindowFocus={true}     // Refetch on focus (does NOT clear)
>
```

**Important Notes:**
- `refetchInterval`: Only refreshes session data if token is valid
- `refetchOnWindowFocus`: Only checks session status, doesn't clear
- Both features **preserve** the session, they don't destroy it

### Tab Switch Behavior

- ✅ Switching tabs does NOT clear session
- ✅ Switching tabs does NOT redirect to login
- ✅ Session persists across all tabs
- ✅ All tabs share the same session state

---

## 📋 4. Token Management

### Cookie Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| **httpOnly** | `true` | Prevents JavaScript access (XSS protection) |
| **secure** | `true` (prod) | HTTPS only in production |
| **sameSite** | `lax` | CSRF protection |
| **maxAge** | 30 days | Session expiration |
| **path** | `/` | Available on all routes |

### Token Readability

- ✅ **Server-side**: Token readable via httpOnly cookie
- ✅ **Client-side**: Token NOT readable (by design for security)
- ✅ **Cross-tab**: Token automatically shared via cookie
- ✅ **Validation**: Token validated on every request

### Session Indicator

- ✅ Stored in localStorage (not the token)
- ✅ Contains: `userId`, `email`, `timestamp`
- ✅ Used for cross-tab sync detection
- ✅ Automatically cleared on logout

---

## 🎯 Expected Results

### ✅ Multiple Tabs

**Scenario 1: Open Multiple Tabs**
1. User logs in Tab 1
2. User opens Tab 2 (same domain)
3. ✅ Tab 2 automatically logged in
4. ✅ No page refresh needed
5. ✅ No forced redirect

**Scenario 2: Login in One Tab**
1. User has Tab 1 open (not logged in)
2. User logs in Tab 2
3. ✅ Tab 1 automatically detects login
4. ✅ Tab 1 restores session
5. ✅ Both tabs now logged in

**Scenario 3: Logout in One Tab**
1. User logged in Tab 1 and Tab 2
2. User logs out Tab 1
3. ✅ Tab 2 automatically detects logout
4. ✅ Tab 2 syncs logout state
5. ✅ Both tabs now logged out

### ✅ No Page Refreshes

- ✅ Login in one tab → Other tabs update without refresh
- ✅ Logout in one tab → Other tabs sync without refresh
- ✅ Tab switch → No refresh, session persists
- ✅ Page refresh → Session restored automatically

### ✅ No Forced Logouts

- ✅ Opening new tab → No logout
- ✅ Switching tabs → No logout
- ✅ Page refresh → No logout (session restored)
- ✅ Browser reopen → No logout (if cookies persist)

---

## 🔧 Technical Details

### Files Modified/Created

**Modified:**
- `lib/session-sync.ts` - Enhanced with session indicator storage
- `app/providers.tsx` - Added automatic session restoration
- `components/SessionInitializer.tsx` - Stores session indicator on login
- `app/login/page.tsx` - Broadcasts login events

**Key Functions:**
- `setSessionIndicator()` - Store indicator in localStorage
- `getSessionIndicator()` - Get indicator from localStorage
- `clearSessionIndicator()` - Clear indicator on logout
- `broadcastSessionEvent()` - Broadcast events to other tabs
- `setupSessionSync()` - Listen for events from other tabs

### Flow Diagram

```
Login in Tab 1:
1. User submits credentials
2. NextAuth validates → Creates JWT token
3. Token stored in httpOnly cookie (automatic)
4. Session indicator stored in localStorage
5. storage event fired
6. Tab 2 detects event → Calls update()
7. Tab 2 restores session from cookie
8. Both tabs now logged in ✅
```

---

## 🧪 Testing

### Test 1: Multiple Tabs Login
1. Open Tab 1 → Not logged in
2. Open Tab 2 → Login
3. ✅ Tab 1 should automatically log in
4. ✅ No page refresh in Tab 1

### Test 2: Tab Switch
1. Login in Tab 1
2. Open Tab 2
3. Switch between tabs
4. ✅ Both tabs remain logged in
5. ✅ No redirects or refreshes

### Test 3: Logout Sync
1. Login in Tab 1 and Tab 2
2. Logout in Tab 1
3. ✅ Tab 2 should automatically log out
4. ✅ No page refresh in Tab 2

### Test 4: Page Refresh
1. Login in Tab 1
2. Refresh Tab 1 (F5)
3. ✅ Should remain logged in
4. ✅ Session restored automatically

---

## ✅ Summary

✅ **Session Persistence**: httpOnly cookies + localStorage indicator  
✅ **Multi-Tab Sync**: localStorage events + automatic restoration  
✅ **No Forced Logout**: Verified - no code clears sessions  
✅ **Token Management**: Proper cookie settings (httpOnly, secure, sameSite)  
✅ **Seamless Experience**: Login/logout syncs across tabs without refresh  

The authentication system now provides seamless multi-tab session synchronization with no forced logouts or unnecessary page refreshes.

