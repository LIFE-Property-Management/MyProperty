import { render, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { makeQueryClient } from "@/test-utils/renderWithQuery";
import { resetAuthStore } from "@/test-utils/resetAuthStore";
import useAuthStore, { type DecodedPayload } from "@/lib/store/auth/useAuthStore";
import { queryKeys } from "@/lib/hooks/queryKeys";
import { HUB_EVENTS } from "@/lib/realtime/events";
import { buildHubConnection } from "@/lib/realtime/connection";
import { getAccessToken } from "@/lib/auth/keycloak";
import { SignalRProvider } from "../SignalRProvider";

// The provider owns the hub connection's lifecycle and the event→invalidation
// wiring. We mock the connection factory (its own wiring is tested separately
// in lib/realtime) and keycloak's token getter, then drive real events through
// the fake connection to assert the cache is invalidated. The auth store and
// the invalidation map are the real implementations.

type Handler = (...args: unknown[]) => void;

interface FakeConnection {
  on: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
  emit: (event: string, payload?: unknown) => void;
}

let fakeConnection: FakeConnection;
let buildArgs: { url: string; tokenFactory: unknown } | null;

function makeFakeConnection(): FakeConnection {
  const handlers = new Map<string, Handler>();
  return {
    on: jest.fn((event: string, cb: Handler) => {
      handlers.set(event, cb);
    }),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    emit: (event, payload) => handlers.get(event)?.(payload),
  };
}

jest.mock("@/lib/realtime/connection", () => ({
  __esModule: true,
  NOTIFICATIONS_HUB_PATH: "/hubs/notifications",
  buildHubConnection: jest.fn((url: string, tokenFactory: unknown) => {
    buildArgs = { url, tokenFactory };
    return fakeConnection;
  }),
}));

jest.mock("@/lib/auth/keycloak", () => ({
  __esModule: true,
  getAccessToken: jest.fn().mockResolvedValue("tok"),
}));

const mockedBuild = buildHubConnection as jest.MockedFunction<typeof buildHubConnection>;

const ORIGINAL_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const ORIGINAL_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS;

function setUser(portal: DecodedPayload["portal"]): void {
  useAuthStore.getState().setAuth({ portal, sub: `sub-${portal}`, email: `${portal}@test.local` });
}

function renderProvider(): { client: QueryClient; invalidateSpy: jest.SpyInstance; unmount: () => void } {
  const client = makeQueryClient();
  const invalidateSpy = jest.spyOn(client, "invalidateQueries");
  const { unmount } = render(<SignalRProvider />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  return { client, invalidateSpy, unmount };
}

beforeEach(() => {
  resetAuthStore();
  jest.clearAllMocks();
  fakeConnection = makeFakeConnection();
  buildArgs = null;
  // Default: a real backend is configured and the dev bypass is off.
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.test";
  delete process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS;
});

afterEach(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = ORIGINAL_BASE_URL;
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS = ORIGINAL_BYPASS;
});

describe("SignalRProvider — connecting", () => {
  it("opens a connection to the hub URL with the keycloak token factory for a landlord", () => {
    setUser("landlord");
    renderProvider();

    expect(mockedBuild).toHaveBeenCalledTimes(1);
    expect(buildArgs?.url).toBe("https://api.test/hubs/notifications");
    expect(buildArgs?.tokenFactory).toBe(getAccessToken);
    expect(fakeConnection.start).toHaveBeenCalledTimes(1);
  });

  it("invalidates payments, dashboard, and tenants when PaymentSubmitted arrives (landlord)", () => {
    setUser("landlord");
    const { invalidateSpy } = renderProvider();

    act(() => fakeConnection.emit(HUB_EVENTS.paymentSubmitted));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.payment.all() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.dashboard() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.tenant.all() });
  });

  it("invalidates the tenant lease cache when LeaseExpiringSoon arrives (tenant)", () => {
    setUser("tenant");
    const { invalidateSpy } = renderProvider();

    act(() => fakeConnection.emit(HUB_EVENTS.leaseExpiringSoon));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.tenant.lease() });
    // A tenant must not be wired to landlord-only events.
    expect(fakeConnection.on).not.toHaveBeenCalledWith(HUB_EVENTS.inviteAccepted, expect.any(Function));
  });

  it("stops the connection on unmount", () => {
    setUser("tenant");
    const { unmount } = renderProvider();

    unmount();

    expect(fakeConnection.stop).toHaveBeenCalledTimes(1);
  });

  it("warns but does not throw when the initial connection fails", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    fakeConnection.start.mockRejectedValueOnce(new Error("handshake failed"));
    setUser("landlord");

    renderProvider();
    // Flush the rejected start() microtask.
    await act(async () => {});

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("SignalRProvider — gating", () => {
  it("does not connect when there is no authenticated user", () => {
    renderProvider();
    expect(mockedBuild).not.toHaveBeenCalled();
  });

  it("does not connect for an admin session (no hub group server-side)", () => {
    setUser("admin");
    renderProvider();
    expect(mockedBuild).not.toHaveBeenCalled();
  });

  it("does not connect under the dev auth bypass (no real token)", () => {
    process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS = "true";
    setUser("landlord");
    renderProvider();
    expect(mockedBuild).not.toHaveBeenCalled();
  });

  it("does not connect when the API base URL is unset (no real backend)", () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    setUser("tenant");
    renderProvider();
    expect(mockedBuild).not.toHaveBeenCalled();
  });
});
