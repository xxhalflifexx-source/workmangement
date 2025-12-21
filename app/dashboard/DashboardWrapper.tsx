"use client";

import { useEffect } from "react";
import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";

export default function DashboardWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Debug logging for Capacitor
    console.log("[Dashboard] Component mounted");
    console.log("[Dashboard] User agent:", navigator.userAgent);
    console.log("[Dashboard] Is Capacitor:", !!(window as any).Capacitor);
    console.log("[Dashboard] Current URL:", window.location.href);
    console.log("[Dashboard] Cookies:", document.cookie);
    console.log("[Dashboard] Cookie count:", document.cookie.split(";").length);
    
    // Check if we're in a WebView
    const isWebView = /(iPhone|iPod|iPad|Android)/i.test(navigator.userAgent) && 
                      !/(Chrome|Safari|Firefox)/i.test(navigator.userAgent);
    console.log("[Dashboard] Is WebView:", isWebView);
    
    // Check for NextAuth session cookie
    const hasNextAuthCookie = document.cookie.includes("next-auth.session-token") || 
                              document.cookie.includes("__Secure-next-auth.session-token");
    console.log("[Dashboard] Has NextAuth cookie:", hasNextAuthCookie);
    
    // If no cookies and we're in Capacitor, there might be a cookie issue
    if ((window as any).Capacitor && !document.cookie) {
      console.warn("[Dashboard] WARNING: No cookies detected in Capacitor WebView!");
      console.warn("[Dashboard] This may cause authentication issues.");
    }
    
    // Log any errors that occur
    const errorHandler = (event: ErrorEvent) => {
      console.error("[Dashboard] Global error:", event.error);
      console.error("[Dashboard] Error message:", event.message);
      console.error("[Dashboard] Error source:", event.filename, event.lineno);
      console.error("[Dashboard] Error colno:", event.colno);
    };
    
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      console.error("[Dashboard] Unhandled promise rejection:", event.reason);
      console.error("[Dashboard] Promise:", event.promise);
    };
    
    window.addEventListener("error", errorHandler);
    window.addEventListener("unhandledrejection", rejectionHandler);
    
    return () => {
      window.removeEventListener("error", errorHandler);
      window.removeEventListener("unhandledrejection", rejectionHandler);
    };
  }, []);

  return (
    <DashboardErrorBoundary>
      {children}
    </DashboardErrorBoundary>
  );
}

