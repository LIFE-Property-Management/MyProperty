import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "kc_token";
const MOCK_TOKEN = "mock.dev.token";
const IS_DEV = process.env.NODE_ENV === "development";
// Mock-auth toggle paired with the client-side short-circuit in
// app/dashboard/_components/KeycloakInit.tsx and app/(tenant)/_components/KeycloakInit.tsx.
// One flag controls both halves so local docker-compose stacks (NODE_ENV=production)
// can run end-to-end without a real Keycloak. Must never be "true" in CI or deployed envs.
const IS_AUTH_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

const PUBLIC_PATHS = new Set<string>(["/", "/login", "/signup", "/logout"]);
const PUBLIC_PREFIXES = ["/invite/"];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE);
  if (token) return NextResponse.next();

  if (IS_DEV || IS_AUTH_BYPASS) {
    const res = NextResponse.next();
    res.cookies.set(AUTH_COOKIE, MOCK_TOKEN, {
      path: "/",
      sameSite: "lax",
    });
    return res;
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("redirectTo", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // silent-check-sso.html must be served as-is for the keycloak-js check-sso iframe;
  // without this exclusion the middleware redirects it to /login, breaking init() and login().
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/public|silent-check-sso.html).*)"],
};
