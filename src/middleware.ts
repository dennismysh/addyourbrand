import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/brands", "/app"];

// Auth.js v5 session cookie names. The Secure-prefixed variant is set on
// HTTPS, the plain one on local dev. We just check existence here — full
// session validation runs server-side via `await auth()` in protected pages,
// because middleware runs at the edge and the DB adapter (pg) isn't edge-safe.
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export default function middleware(req: NextRequest) {
  const isProtected = PROTECTED_PREFIXES.some((p) =>
    req.nextUrl.pathname.startsWith(p),
  );
  if (!isProtected) return;

  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (hasSession) return;

  const signInUrl = new URL("/signin", req.url);
  signInUrl.searchParams.set("from", req.nextUrl.pathname);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
