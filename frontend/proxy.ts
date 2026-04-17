import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "kc_token";
const MOCK_TOKEN = "mock.dev.token";
const IS_DEV = process.env.NODE_ENV === "development";

export function proxy(req: NextRequest) {
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
  url.searchParams.set("redirectTo", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
