/**
 * Session synchronization utilities for cross-tab session management
 */

export const SESSION_STORAGE_KEY = "nextauth.message";

/**
 * Broadcast a session event to other tabs
 */
export function broadcastSessionEvent(event: "signin" | "signout" | "update") {
  if (typeof window === "undefined") return;
  
  const timestamp = Date.now().toString();
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ event, timestamp }));
  // Remove immediately to trigger storage event
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

/**
 * Listen for session events from other tabs
 */
export function setupSessionSync(
  onSignIn?: () => void,
  onSignOut?: () => void,
  onUpdate?: () => void
) {
  if (typeof window === "undefined") return () => {};

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === SESSION_STORAGE_KEY && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        switch (data.event) {
          case "signin":
            onSignIn?.();
            break;
          case "signout":
            onSignOut?.();
            break;
          case "update":
            onUpdate?.();
            break;
        }
      } catch (error) {
        // Ignore parse errors
      }
    }
  };

  window.addEventListener("storage", handleStorageChange);
  
  return () => {
    window.removeEventListener("storage", handleStorageChange);
  };
}

