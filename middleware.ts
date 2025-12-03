import NextAuthMiddleware from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Bypass auth in development unless explicitly disabled
const shouldBypass = process.env.DEV_BYPASS_AUTH === "true" || process.env.NODE_ENV !== "production";

export default async function middleware(req: NextRequest) {
	if (shouldBypass) {
		return NextResponse.next();
	}

	// First check authentication
	const authResponse = NextAuthMiddleware(req);
	
	// If auth fails, return the auth response
	if (authResponse.status !== 200) {
		return authResponse;
	}

	// For authenticated users, check permissions
	// Note: Permission checking in middleware is limited because we can't easily access the session
	// The actual permission checks will be done in the page components
	// This middleware just ensures authentication
	
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
	],
};



