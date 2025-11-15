import { NextResponse } from "next/server";

export async function POST() {
  // NextAuth handles signout at /api/auth/signout, but ensure redirect
  return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000"));
}




