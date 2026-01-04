/**
 * Session synchronization utilities for cross-tab session management
 * 
 * This module handles:
 * - Storing session indicators in localStorage (not the token itself - that's in httpOnly cookie)
 * - Broadcasting login/logout events across tabs
 * - Automatically restoring sessions in other tabs when login occurs
 */

export const SESSION_STORAGE_KEY = "nextauth.message";
export const SESSION_INDICATOR_KEY = "nextauth.session.indicator";

// Track last known indicator to prevent duplicate callbacks
let lastKnownUserId: string | null = null;
let lastEventTime = 0;
const DEBOUNCE_MS = 2000; // Minimum 2 seconds between sync events

/**
 * Store session indicator in localStorage
 * This is NOT the token (which is in httpOnly cookie), but an indicator for cross-tab sync
 */
export function setSessionIndicator(userId: string, email: string) {
  if (typeof window === "undefined") return;
  
  // Update our tracking of the current user
  lastKnownUserId = userId;
  
  const indicator = {
    userId,
    email,
    timestamp: Date.now(),
  };
  
  window.localStorage.setItem(SESSION_INDICATOR_KEY, JSON.stringify(indicator));
}

/**
 * Get session indicator from localStorage
 */
export function getSessionIndicator(): { userId: string; email: string; timestamp: number } | null {
  if (typeof window === "undefined") return null;
  
  try {
    const stored = window.localStorage.getItem(SESSION_INDICATOR_KEY);
    if (!stored) return null;
    
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Clear session indicator from localStorage
 */
export function clearSessionIndicator() {
  if (typeof window === "undefined") return;
  lastKnownUserId = null;
  window.localStorage.removeItem(SESSION_INDICATOR_KEY);
}

/**
 * Broadcast a session event to other tabs
 * This triggers storage events that other tabs can listen to
 */
export function broadcastSessionEvent(event: "signin" | "signout" | "update", userId?: string, email?: string) {
  if (typeof window === "undefined") return;
  
  const timestamp = Date.now().toString();
  const data = { event, timestamp, userId, email };
  
  // Store event in localStorage to trigger storage event
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
  
  // If signin, also store session indicator
  if (event === "signin" && userId && email) {
    setSessionIndicator(userId, email);
  }
  
  // If signout, clear session indicator
  if (event === "signout") {
    clearSessionIndicator();
  }
  
  // Remove immediately to allow subsequent events
  // The storage event has already been fired
  setTimeout(() => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }, 100);
}

/**
 * Listen for session events from other tabs
 * Automatically restores session when login occurs in another tab
 */
export function setupSessionSync(
  onSignIn?: () => void,
  onSignOut?: () => void,
  onUpdate?: () => void
) {
  if (typeof window === "undefined") return () => {};

  const handleStorageChange = (e: StorageEvent) => {
    const now = Date.now();
    
    // Debounce: ignore events that happen too quickly
    if (now - lastEventTime < DEBOUNCE_MS) {
      return;
    }
    
    // Handle session event broadcasts (explicit signin/signout/update events)
    if (e.key === SESSION_STORAGE_KEY && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        switch (data.event) {
          case "signin":
            // Another tab signed in - restore session in this tab
            console.log("[SessionSync] Sign in detected in another tab");
            lastEventTime = now;
            onSignIn?.();
            break;
          case "signout":
            // Another tab signed out - update this tab
            console.log("[SessionSync] Sign out detected in another tab");
            lastEventTime = now;
            lastKnownUserId = null;
            onSignOut?.();
            break;
          case "update":
            // Session updated in another tab
            console.log("[SessionSync] Session update detected in another tab");
            lastEventTime = now;
            onUpdate?.();
            break;
        }
      } catch (error) {
        // Ignore parse errors
        console.error("[SessionSync] Error parsing session event:", error);
      }
    }
    
    // Handle session indicator changes - ONLY for actual user changes
    if (e.key === SESSION_INDICATOR_KEY) {
      if (e.newValue) {
        try {
          const indicator = JSON.parse(e.newValue);
          // Only trigger if this is a DIFFERENT user signing in
          // (not just an indicator refresh for the same user)
          if (indicator.userId && indicator.userId !== lastKnownUserId) {
            console.log("[SessionSync] New user session detected in another tab");
            lastKnownUserId = indicator.userId;
            lastEventTime = now;
            onSignIn?.();
          }
          // If same user, just update our tracking silently
          else if (indicator.userId) {
            lastKnownUserId = indicator.userId;
          }
        } catch {
          // Ignore parse errors
        }
      } else {
        // Session indicator was removed (logout in another tab)
        if (lastKnownUserId !== null) {
          console.log("[SessionSync] Session indicator removed in another tab");
          lastKnownUserId = null;
          lastEventTime = now;
          onSignOut?.();
        }
      }
    }
  };

  // Initialize lastKnownUserId from current indicator
  const currentIndicator = getSessionIndicator();
  if (currentIndicator) {
    lastKnownUserId = currentIndicator.userId;
  }

  window.addEventListener("storage", handleStorageChange);
  
  return () => {
    window.removeEventListener("storage", handleStorageChange);
  };
}

