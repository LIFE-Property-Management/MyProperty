import { renderHook, act } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { makeQueryClient } from "@/test-utils/renderWithQuery";
import apiClient from "@/lib/api/client";
import { capture, ANALYTICS_EVENTS } from "@/lib/analytics";
import { queryKeys } from "../queryKeys";
import { useCreateInvite } from "../useCreateInvite";
import type { CreateInviteInput } from "@/lib/types/landlord/invite";

jest.mock("@/lib/api/client", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

// Mock only the capture facade; keep the real ANALYTICS_EVENTS map (from
// events.ts, which has no posthog-js import) so the assertion uses the real name.
jest.mock("@/lib/analytics", () => ({
  __esModule: true,
  capture: jest.fn(),
  ANALYTICS_EVENTS: jest.requireActual("@/lib/analytics/events").ANALYTICS_EVENTS,
}));

const mockedPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
const mockedCapture = capture as jest.MockedFunction<typeof capture>;

function makeWrapper() {
  const client = makeQueryClient();
  const invalidateSpy = jest.spyOn(client, "invalidateQueries");
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryWrapper";
  return { Wrapper, invalidateSpy };
}

const input: CreateInviteInput = {
  propertyId: "22222222-2222-2222-2222-222222222222",
  email: "tenant@example.com",
  firstName: "Tess",
  lastName: "Tenant",
  proposedStartDate: "2030-01-01",
  proposedEndDate: "2031-01-01",
  proposedMonthlyRent: 1200,
  currency: "EUR",
};

beforeEach(() => {
  mockedPost.mockReset();
  mockedCapture.mockReset();
});

describe("useCreateInvite", () => {
  it("posts the invite to /invites", async () => {
    mockedPost.mockResolvedValueOnce({ data: { inviteId: input.propertyId, expiresAt: "2030-01-08T00:00:00Z" } });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateInvite(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(mockedPost).toHaveBeenCalledWith("/invites", input);
  });

  it("fires tenant_invited and invalidates invite, property, and dashboard caches on success", async () => {
    mockedPost.mockResolvedValueOnce({ data: {} });
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreateInvite(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(mockedCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.tenantInvited, {
      propertyId: input.propertyId,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.invites.all() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.property.all() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.dashboard() });
  });

  it("does not capture or invalidate when the request fails", async () => {
    mockedPost.mockRejectedValueOnce(new Error("network"));
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreateInvite(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(input).catch(() => {});
    });

    expect(mockedCapture).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
