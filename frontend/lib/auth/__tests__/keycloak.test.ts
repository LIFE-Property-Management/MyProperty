import { resetAuthStore } from "@/test-utils/resetAuthStore";

// Isolate the module so the `initialized` flag and `cachedToken` reset between tests.
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

describe("keycloak (mock adapter)", () => {
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

  it("decodePayload does not include tenantAccountStatus in return value", async () => {
    const { decodePayload } = await import("../keycloak");
    const result = decodePayload(makeJwt(["tenant"]));
    expect(result).not.toHaveProperty("tenantAccountStatus");
  });

  it("getToken returns null before initKeycloak", async () => {
    const { getToken } = await import("../keycloak");
    expect(getToken()).toBeNull();
  });

  it("initKeycloak populates useAuthStore with the correct portal", async () => {
    const { initKeycloak } = await import("../keycloak");
    const useAuthStore = (await import("@/lib/store/auth/useAuthStore")).default;
    initKeycloak();
    const user = useAuthStore.getState().user;
    expect(user?.portal).toBe("tenant");
    expect(user?.sub).toBe("0193b42d-df5a-7f2a-8c3b-e2f8a97c1456");
    expect(user?.email).toBe("tenant@dev.local");
  });

  it("getToken returns the fake JWT after initKeycloak", async () => {
    const { initKeycloak, getToken } = await import("../keycloak");
    initKeycloak();
    const token = getToken();
    expect(typeof token).toBe("string");
    expect(token).toMatch(/^ey/);
  });

  it("initKeycloak is idempotent (setAuth called only once)", async () => {
    const useAuthStore = (await import("@/lib/store/auth/useAuthStore")).default;
    const setAuthSpy = jest.spyOn(useAuthStore.getState(), "setAuth");
    const { initKeycloak } = await import("../keycloak");
    initKeycloak();
    initKeycloak();
    expect(setAuthSpy).toHaveBeenCalledTimes(1);
  });

  it("clearCachedToken makes getToken return null again", async () => {
    const { initKeycloak, getToken, clearCachedToken } = await import("../keycloak");
    initKeycloak();
    expect(getToken()).not.toBeNull();
    clearCachedToken();
    expect(getToken()).toBeNull();
  });
});
