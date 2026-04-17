import { resetTenantStore } from "@/test-utils/resetTenantStore";

// The FAKE_JWT decodes to: sub='0193b42d-df5a-7f2a-8c3b-e2f8a97c1456',
// email='tenant@dev.local', tenantAccountStatus='Active'. We isolate the module
// so initKeycloak's module-scope `initialized` flag resets between tests.

beforeEach(() => {
  resetTenantStore();
  jest.resetModules();
});

describe("keycloak (mock adapter)", () => {
  it("getToken returns the fake JWT string", async () => {
    const { getToken } = await import("../keycloak");
    const token = getToken();
    expect(typeof token).toBe("string");
    expect(token).toMatch(/^ey/); // base64 header prefix
  });

  it("initKeycloak populates the tenant store from the decoded JWT payload", async () => {
    const { initKeycloak } = await import("../keycloak");
    const useTenantStore = (await import("@/lib/store/useTenantStore")).default;
    initKeycloak();
    const state = useTenantStore.getState();
    expect(state.userId).toBe("0193b42d-df5a-7f2a-8c3b-e2f8a97c1456");
    expect(state.email).toBe("tenant@dev.local");
    expect(state.tenantAccountStatus).toBe("Active");
    expect(state.isReadOnly).toBe(false);
  });

  it("initKeycloak is idempotent (second call does not re-dispatch setAuth)", async () => {
    const { initKeycloak } = await import("../keycloak");
    const useTenantStore = (await import("@/lib/store/useTenantStore")).default;
    initKeycloak();
    const firstSnapshot = useTenantStore.getState().userId;
    // Mutate store between calls; if init were re-entrant, it'd restore from JWT.
    useTenantStore.setState({ userId: "mutated" });
    initKeycloak();
    expect(useTenantStore.getState().userId).toBe("mutated");
    expect(firstSnapshot).not.toBe("mutated");
  });
});
