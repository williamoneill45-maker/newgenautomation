import { NextResponse, type NextRequest } from "next/server";
import { authCookieName, authSessionValue } from "./lib/auth-gate";

const publicPaths = new Set(["/login", "/api/login", "/api/logout"]);

function isPublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.has(pathname) || isPublicAsset(pathname)) {
    return NextResponse.next();
  }

  const isAuthenticated = request.cookies.get(authCookieName)?.value === authSessionValue;

  if (isAuthenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};

