import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "kc_token";
const MOCK_TOKEN = "mock.dev.token";
const IS_DEV = process.env.NODE_ENV === "development";

const PUBLIC_PATHS = new Set<string>(["/"]);
const PUBLIC_PREFIXES = ["/invite/"];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE);
  if (token) return NextResponse.next();

  if (IS_DEV) {
    const res = NextResponse.next();
    res.cookies.set(AUTH_COOKIE, MOCK_TOKEN, {
      path: "/",
      sameSite: "lax",
    });
    return res;
  }

  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("redirectTo", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/public).*)"],
};
