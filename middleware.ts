import NextAuthMiddleware from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Bypass auth in development unless explicitly disabled
const shouldBypass = process.env.DEV_BYPASS_AUTH === "true" || process.env.NODE_ENV !== "production";

export default function middleware(req: NextRequest) {
	if (shouldBypass) {
		return NextResponse.next();
	}
	// Defer to NextAuth middleware for protected routes
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



