import NextAuthMiddleware from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Bypass auth in development unless explicitly disabled
const shouldBypass = process.env.DEV_BYPASS_AUTH === "true" || process.env.NODE_ENV !== "production";

export default function middleware(req: NextRequest) {
	if (shouldBypass) {
		return NextResponse.next();
	}
	
	// iOS Safari compatibility: Allow requests through and let pages handle auth
	// This prevents middleware from blocking iOS Safari cookie issues
	const userAgent = req.headers.get("user-agent") || "";
	const isIOS = /iPad|iPhone|iPod/.test(userAgent);
	
	if (isIOS) {
		// For iOS, let the request through - pages will handle auth client-side
		// This allows iOS Safari time to read cookies
		return NextResponse.next();
	}
	
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
	],
};



