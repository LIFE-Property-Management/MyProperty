/**
 * Middleware tests exercise the route-matching logic directly. We can't import
 * the real next/server module cleanly in jsdom, so we mock NextResponse with a
 * minimal surface that captures what the middleware called.
 */

const nextCalls: Array<{ type: "next" | "redirect"; url?: string; cookie?: Record<string, unknown> }> = [];

function makeResponse(type: "next" | "redirect", url?: string) {
  const record: { type: "next" | "redirect"; url?: string; cookie?: Record<string, unknown> } = {
    type,
    url,
  };
  nextCalls.push(record);
  return {
    cookies: {
      set: (name: string, value: string, options: Record<string, unknown>) => {
        record.cookie = { name, value, options };
      },
    },
  };
}

jest.mock("next/server", () => {
  return {
    NextResponse: {
      next: () => makeResponse("next"),
      redirect: (url: URL) => makeResponse("redirect", url.toString()),
    },
  };
});

function makeRequest(pathname: string, token?: string) {
  const nextUrl = new URL(`http://localhost${pathname}`);
  // NextRequest has a clone() that returns a URL-like object; jsdom's URL works.
  (nextUrl as unknown as { clone: () => URL }).clone = () => new URL(nextUrl.toString());
  return {
    nextUrl,
    cookies: {
      get: (name: string) => (token && name === "kc_token" ? { name, value: token } : undefined),
    },
  } as unknown as import("next/server").NextRequest;
}

describe("proxy", () => {
  beforeEach(() => {
    nextCalls.length = 0;
    jest.resetModules();
  });

  it("allows the public root path without auth", async () => {
    const { default: middleware } = await import("../proxy");
    middleware(makeRequest("/"));
    expect(nextCalls).toHaveLength(1);
    expect(nextCalls[0].type).toBe("next");
    expect(nextCalls[0].cookie).toBeUndefined();
  });

  it("passes through an authed request with a kc_token cookie", async () => {
    const { default: middleware } = await import("../proxy");
    middleware(makeRequest("/tenant/dashboard", "real.token"));
    expect(nextCalls).toHaveLength(1);
    expect(nextCalls[0].type).toBe("next");
    expect(nextCalls[0].cookie).toBeUndefined();
  });

  it("in development, stamps a mock token cookie when none is present", async () => {
    const restore = jest.replaceProperty(process.env, "NODE_ENV", "development");
    try {
      await jest.isolateModulesAsync(async () => {
        const { default: middleware } = await import("../proxy");
        middleware(makeRequest("/tenant/dashboard"));
      });
      expect(nextCalls).toHaveLength(1);
      expect(nextCalls[0].type).toBe("next");
      expect(nextCalls[0].cookie).toBeDefined();
      expect(nextCalls[0].cookie?.name).toBe("kc_token");
    } finally {
      restore.restore();
    }
  });

  it("in production, redirects to / with a redirectTo query param when unauthed", async () => {
    const restore = jest.replaceProperty(process.env, "NODE_ENV", "production");
    try {
      await jest.isolateModulesAsync(async () => {
        const { default: middleware } = await import("../proxy");
        middleware(makeRequest("/tenant/dashboard"));
      });
      expect(nextCalls).toHaveLength(1);
      expect(nextCalls[0].type).toBe("redirect");
      expect(nextCalls[0].url).toContain("redirectTo=%2Ftenant%2Fdashboard");
    } finally {
      restore.restore();
    }
  });

  it("in production with NEXT_PUBLIC_DEV_AUTH_BYPASS=true, stamps a mock token cookie", async () => {
    const restoreEnv = jest.replaceProperty(process.env, "NODE_ENV", "production");
    const prevBypass = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS;
    process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS = "true";
    try {
      await jest.isolateModulesAsync(async () => {
        const { default: middleware } = await import("../proxy");
        middleware(makeRequest("/tenant/dashboard"));
      });
      expect(nextCalls).toHaveLength(1);
      expect(nextCalls[0].type).toBe("next");
      expect(nextCalls[0].cookie).toBeDefined();
      expect(nextCalls[0].cookie?.name).toBe("kc_token");
    } finally {
      if (prevBypass === undefined) delete process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS;
      else process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS = prevBypass;
      restoreEnv.restore();
    }
  });
});
