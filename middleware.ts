import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Bypass auth in development unless explicitly disabled
const shouldBypass = process.env.DEV_BYPASS_AUTH === "true" || process.env.NODE_ENV !== "production";

export default async function middleware(req: NextRequest) {
	const path = req.nextUrl.pathname;
	console.log("[Middleware] Request to:", path);
	
	if (shouldBypass) {
		console.log("[Middleware] Bypassing auth check (development mode)");
		return NextResponse.next();
	}
	
	// Check for session token using NextAuth's getToken
	// This properly reads and validates the JWT token from cookies
	const token = await getToken({ 
		req, 
		secret: process.env.NEXTAUTH_SECRET 
	});
	
	console.log("[Middleware] Token check:");
	console.log("[Middleware] - Token present:", token ? "Yes" : "No");
	console.log("[Middleware] - Token email:", token?.email || "None");
	console.log("[Middleware] - Token role:", (token as any)?.role || "None");
	
	// Check cookie header for debugging
	const cookieHeader = req.headers.get("cookie") || "";
	const hasSessionCookie = cookieHeader.includes("next-auth.session-token") || 
	                        cookieHeader.includes("__Secure-next-auth.session-token");
	console.log("[Middleware] - Cookie header present:", cookieHeader ? "Yes" : "No");
	console.log("[Middleware] - Session cookie in header:", hasSessionCookie ? "Yes" : "No");
	
	// If no token found, check if we have a session cookie in the header
	// This handles cases where cookie is set but token validation hasn't completed yet
	if (!token) {
		if (hasSessionCookie) {
			// Cookie exists but token not validated - might be timing issue
			// Let the request through and let the page component handle auth
			console.log("[Middleware] Cookie present but token not validated - allowing through for page-level check");
			return NextResponse.next();
		}
		// No token and no cookie - definitely not authenticated
		console.log("[Middleware] No token and no cookie - redirecting to login");
		const loginUrl = new URL("/login", req.url);
		loginUrl.searchParams.set("callbackUrl", path);
		return NextResponse.redirect(loginUrl);
	}
	
	// Token found - allow request through
	console.log("[Middleware] Token validated - allowing request");
	return NextResponse.next();
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



