import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Edge-safe auth check only — no Prisma here (see auth.config.ts).
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isDashboard = req.nextUrl.pathname.startsWith("/dashboard");

  if (isDashboard && !req.auth) {
    // Rewrite (not redirect) so an unauthenticated visitor sees a plain 404
    // at the original URL — the dashboard's existence isn't disclosed.
    return NextResponse.rewrite(new URL("/concealed-404", req.url));
  }
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
