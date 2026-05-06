import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/brands", "/app"];

export default auth((req) => {
  const isProtected = PROTECTED_PREFIXES.some((p) =>
    req.nextUrl.pathname.startsWith(p),
  );
  if (isProtected && !req.auth) {
    const signInUrl = new URL("/signin", req.url);
    signInUrl.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  // Skip static assets and Auth.js's own routes.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
