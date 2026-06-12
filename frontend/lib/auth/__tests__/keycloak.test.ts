import { resetAuthStore } from "@/test-utils/resetAuthStore";

// Isolate the module so `initialized` and `_keycloak` reset between tests.
beforeEach(() => {
  resetAuthStore();
  jest.resetModules();
});

// Helpers to build minimal JWTs for testing decodePayload.
function makeJwt(roles: string[]): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  const payload = btoa(
      JSON.stringify({
        sub: "test-sub",
        email: "test@dev.local",
        realm_access: { roles },
      }),
  )
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `${header}.${payload}.sig`;
}

// Mock keycloak-js. The factory runs each time the module is re-required after
// jest.resetModules(), so each test gets a fresh Keycloak instance.
jest.mock("keycloak-js", () => {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  const payload = btoa(
      JSON.stringify({
        sub: "test-sub",
        email: "test@dev.local",
        realm_access: { roles: ["tenant"] },
      }),
  )
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  const mockToken = `${header}.${payload}.sig`;

  return {
    __esModule: true,
    default: jest.fn(() => ({
      init: jest.fn().mockResolvedValue(true),
      token: mockToken,
      logout: jest.fn().mockResolvedValue(undefined),
      onTokenExpired: undefined as (() => void) | undefined,
      updateToken: jest.fn().mockResolvedValue(true),
    })),
  };
});

describe("keycloak", () => {
  it("decodePayload with tenant-role token returns portal=tenant, sub, email", async () => {
    const { decodePayload } = await import("../keycloak");
    const result = decodePayload(makeJwt(["tenant"]));
    expect(result.portal).toBe("tenant");
    expect(result.sub).toBe("test-sub");
    expect(result.email).toBe("test@dev.local");
  });

  it("decodePayload with landlord-role token returns portal=landlord", async () => {
    const { decodePayload } = await import("../keycloak");
    const result = decodePayload(makeJwt(["landlord"]));
    expect(result.portal).toBe("landlord");
  });

  it("decodePayload with no matching role throws", async () => {
    const { decodePayload } = await import("../keycloak");
    expect(() => decodePayload(makeJwt(["unknown-role"]))).toThrow(
        "JWT has no recognized portal role",
    );
  });

  it("decodePayload with two matching roles throws", async () => {
    const { decodePayload } = await import("../keycloak");
    expect(() => decodePayload(makeJwt(["tenant", "landlord"]))).toThrow(
        "JWT has multiple portal roles",
    );
  });

  it("decodePayload does not include accountStatus in return value", async () => {
    const { decodePayload } = await import("../keycloak");
    const result = decodePayload(makeJwt(["tenant"]));
    // Domain account status is fetched from /me (MeDto.accountStatus), never
    // carried in the JWT — see frontend/CLAUDE.md § Auth.
    expect(result).not.toHaveProperty("accountStatus");
    expect(result).not.toHaveProperty("tenantAccountStatus");
  });

  it("getToken returns null before initKeycloak", async () => {
    const { getToken } = await import("../keycloak");
    expect(getToken()).toBeNull();
  });

  it("initKeycloak populates useAuthStore with the correct portal", async () => {
    const { initKeycloak } = await import("../keycloak");
    const useAuthStore = (await import("@/lib/store/auth/useAuthStore")).default;
    await initKeycloak();
    const user = useAuthStore.getState().user;
    expect(user?.portal).toBe("tenant");
    expect(user?.sub).toBe("test-sub");
    expect(user?.email).toBe("test@dev.local");
  });

  it("getToken returns the Keycloak token after initKeycloak", async () => {
    const { initKeycloak, getToken } = await import("../keycloak");
    await initKeycloak();
    const token = getToken();
    expect(typeof token).toBe("string");
    expect(token).toMatch(/^ey/);
  });

  it("initKeycloak is idempotent (setAuth called only once)", async () => {
    const useAuthStore = (await import("@/lib/store/auth/useAuthStore")).default;
    const setAuthSpy = jest.spyOn(useAuthStore.getState(), "setAuth");
    const { initKeycloak } = await import("../keycloak");
    await initKeycloak();
    await initKeycloak();
    expect(setAuthSpy).toHaveBeenCalledTimes(1);
  });

  it("clearCachedToken makes getToken return null again", async () => {
    const { initKeycloak, getToken, clearCachedToken } = await import("../keycloak");
    await initKeycloak();
    expect(getToken()).not.toBeNull();
    clearCachedToken();
    expect(getToken()).toBeNull();
  });
});

describe("resetPasswordUrl", () => {
  const ENV_KEYS = [
    "NEXT_PUBLIC_KEYCLOAK_URL",
    "NEXT_PUBLIC_KEYCLOAK_REALM",
    "NEXT_PUBLIC_KEYCLOAK_CLIENT_ID",
  ] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    process.env.NEXT_PUBLIC_KEYCLOAK_URL = "http://localhost:8080";
    process.env.NEXT_PUBLIC_KEYCLOAK_REALM = "MyProperty";
    process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID = "myproperty-frontend";
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("builds Keycloak's reset-credentials URL from the public env", async () => {
    const { resetPasswordUrl } = await import("../keycloak");
    expect(resetPasswordUrl()).toBe(
      "http://localhost:8080/realms/MyProperty/login-actions/reset-credentials?client_id=myproperty-frontend",
    );
  });

  it("strips a trailing slash from the Keycloak base URL", async () => {
    process.env.NEXT_PUBLIC_KEYCLOAK_URL = "http://localhost:8080/";
    const { resetPasswordUrl } = await import("../keycloak");
    expect(resetPasswordUrl()).toBe(
      "http://localhost:8080/realms/MyProperty/login-actions/reset-credentials?client_id=myproperty-frontend",
    );
  });
});
