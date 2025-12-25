import NextAuthMiddleware from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Bypass auth in development unless explicitly disabled
const shouldBypass = process.env.DEV_BYPASS_AUTH === "true" || process.env.NODE_ENV !== "production";

export default function middleware(req: NextRequest) {
	const path = req.nextUrl.pathname;
	console.log("[Middleware] Request to:", path);
	
	// Check for session cookie in request
	const cookieHeader = req.headers.get("cookie") || "";
	const sessionCookieName = process.env.NODE_ENV === "production" 
		? "__Secure-next-auth.session-token" 
		: "next-auth.session-token";
	const hasSessionCookie = cookieHeader.includes(sessionCookieName) || cookieHeader.includes("next-auth.session-token");
	
	console.log("[Middleware] Cookie check:");
	console.log("[Middleware] - Cookie header present:", cookieHeader ? "Yes" : "No");
	console.log("[Middleware] - Session cookie present:", hasSessionCookie ? "Yes" : "No");
	console.log("[Middleware] - Cookie header length:", cookieHeader.length);
	console.log("[Middleware] - Bypass auth:", shouldBypass);
	
	if (shouldBypass) {
		console.log("[Middleware] Bypassing auth check");
		return NextResponse.next();
	}
	
	// iOS Safari and Android WebView compatibility: Allow requests through and let pages handle auth
	// This prevents middleware from blocking cookie issues in mobile WebViews
	const userAgent = req.headers.get("user-agent") || "";
	const isIOS = /iPad|iPhone|iPod/.test(userAgent);
	const isAndroidWebView = /Android.*wv|wv.*Android/i.test(userAgent) || 
	                         /Android/i.test(userAgent) && !/Chrome/i.test(userAgent);
	const isCapacitor = userAgent.includes("CapacitorHttp") || 
	                    req.headers.get("x-capacitor-platform");
	
	if (isIOS || isAndroidWebView || isCapacitor) {
		console.log("[Middleware] Mobile/WebView detected - allowing through");
		// For mobile WebViews/Capacitor, let the request through - pages will handle auth client-side
		// This allows WebView time to read cookies properly
		const response = NextResponse.next();
		// Ensure cookies are accessible
		response.headers.set("Access-Control-Allow-Credentials", "true");
		return response;
	}
	
	console.log("[Middleware] Delegating to NextAuth middleware");
	// Defer to NextAuth middleware for protected routes (non-iOS)
	// @ts-ignore - next-auth middleware types accept NextRequest
	return NextAuthMiddleware(req);
}

export const config = {
	matcher: [
		"/dashboard/:path*",
		"/jobs/:path*",
		"/time-clock/:path*",
		"/inventory/:path*",
		"/admin/:path*",
		"/invoices/:path*",
		"/finance/:path*",
		"/hr/:path*",
		"/super-admin/:path*", // Super Admin dashboard
		"/incident-reports/:path*", // Incident Reports (Admin only)
		"/quotations/:path*", // Quotations (Admin/Manager only)
	],
};



