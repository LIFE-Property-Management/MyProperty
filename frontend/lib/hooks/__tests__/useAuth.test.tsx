import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import useAuthStore from "@/lib/store/auth/useAuthStore";
import { resetAuthStore } from "@/test-utils/resetAuthStore";
import apiClient from "@/lib/api/client";
import { logout as keycloakLogout } from "@/lib/auth/keycloak";
import { useAuth } from "../useAuth";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock("@/lib/api/client", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock("@/lib/auth/keycloak", () => ({
  clearCachedToken: jest.fn(),
  initKeycloak: jest.fn(),
  getToken: jest.fn(),
  decodePayload: jest.fn(),
  logout: jest.fn().mockResolvedValue(undefined),
}));

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
const mockKeycloakLogout = keycloakLogout as jest.Mock;

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryWrapper";
  return Wrapper;
}

beforeEach(() => {
  resetAuthStore();
  mockedGet.mockReset();
  // /me now fires for any authenticated user; give it a benign default so tests
  // that don't care about the response don't hit an unmocked call. Per-test
  // mockResolvedValueOnce still takes precedence.
  mockedGet.mockResolvedValue({ data: { accountStatus: null } });
  mockPush.mockReset();
  mockKeycloakLogout.mockClear();
  delete process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS;
  // jsdom doesn't ship fetch; stub it so signOut doesn't throw.
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

describe("useAuth", () => {
  it("isAuthenticated is false when user is null", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("isAuthenticated is true when user is set", () => {
    useAuthStore.setState({ user: { portal: "landlord", sub: "s1", email: "l@dev.local" } });
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("isReadOnly is false when portal is landlord (even though /me is fetched for the name)", async () => {
    useAuthStore.setState({ user: { portal: "landlord", sub: "s1", email: "l@dev.local" } });
    mockedGet.mockResolvedValueOnce({ data: { firstName: "Lara", lastName: "Landlord", accountStatus: null } });
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isMeLoading).toBe(false));
    expect(result.current.isReadOnly).toBe(false);
    // /me now fires for every authenticated user — it carries the profile name.
    expect(mockedGet).toHaveBeenCalledWith("/me");
  });

  it("surfaces firstName/lastName from /me", async () => {
    useAuthStore.setState({ user: { portal: "landlord", sub: "s1", email: "l@dev.local" } });
    mockedGet.mockResolvedValueOnce({ data: { firstName: "Drin", lastName: "Prekaj", accountStatus: null } });
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.firstName).toBe("Drin"));
    expect(result.current.lastName).toBe("Prekaj");
  });

  it("normalizes blank/whitespace name fields to null", async () => {
    useAuthStore.setState({ user: { portal: "landlord", sub: "s1", email: "l@dev.local" } });
    mockedGet.mockResolvedValueOnce({ data: { firstName: "  ", lastName: "", accountStatus: null } });
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isMeLoading).toBe(false));
    expect(result.current.firstName).toBeNull();
    expect(result.current.lastName).toBeNull();
  });

  it("isReadOnly is false when portal is tenant and isMeLoading is true", () => {
    useAuthStore.setState({ user: { portal: "tenant", sub: "s1", email: "t@dev.local" } });
    // Keep the promise pending so isMeLoading stays true
    mockedGet.mockReturnValueOnce(new Promise(() => {}));
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    expect(result.current.isMeLoading).toBe(true);
    expect(result.current.isReadOnly).toBe(false);
  });

  it("isReadOnly is true when portal is tenant and accountStatus is ReadOnly", async () => {
    useAuthStore.setState({ user: { portal: "tenant", sub: "s1", email: "t@dev.local" } });
    mockedGet.mockResolvedValueOnce({ data: { accountStatus: "ReadOnly" } });
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isMeLoading).toBe(false));
    expect(result.current.isReadOnly).toBe(true);
  });

  it("signOut delegates to Keycloak end-session logout, returning to /logout", async () => {
    useAuthStore.setState({ user: { portal: "tenant", sub: "s1", email: "t@dev.local" } });
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await act(() => result.current.signOut());
    expect(mockKeycloakLogout).toHaveBeenCalledWith(expect.stringMatching(/\/logout$/));
    // It must NOT do a local-only client redirect, which would leave the
    // Keycloak SSO session alive and let check-sso silently re-auth.
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("signOut in dev-bypass clears the store locally and shows the /logout page", async () => {
    process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS = "true";
    useAuthStore.setState({ user: { portal: "tenant", sub: "s1", email: "t@dev.local" } });
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await act(() => result.current.signOut());
    expect(useAuthStore.getState().user).toBeNull();
    expect(mockPush).toHaveBeenCalledWith("/logout");
    expect(mockKeycloakLogout).not.toHaveBeenCalled();
  });
});
