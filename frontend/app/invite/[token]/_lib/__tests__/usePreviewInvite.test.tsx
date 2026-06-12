import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/test-utils/renderWithQuery";
import apiClient from "@/lib/api/client";
import { usePreviewInvite } from "../usePreviewInvite";
import type { InvitePreview } from "../invite";

// Verifies the query hook's contract: it hits the by-token preview endpoint,
// validates the payload against the Zod schema, and surfaces errors (e.g. a 404
// unknown token) without retrying. apiClient is mocked.
jest.mock("@/lib/api/client", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

function makeWrapper() {
  const client = makeQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryWrapper";
  return Wrapper;
}

function previewPayload(overrides: Partial<InvitePreview> = {}): InvitePreview {
  return {
    status: "Pending",
    propertyName: "Maple Court",
    propertyAddress: "123 Main St, Prishtina",
    landlordFullName: "Ada Landlord",
    tenantFirstName: "Jane",
    tenantLastName: "Doe",
    tenantEmail: "tenant@example.com",
    proposedStartDate: "2026-05-01",
    proposedEndDate: "2027-04-30",
    proposedMonthlyRent: 450,
    currency: "EUR",
    expiresAt: "2026-04-24T09:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  mockedGet.mockReset();
});

describe("usePreviewInvite", () => {
  it("fetches and validates the preview from the by-token endpoint", async () => {
    mockedGet.mockResolvedValueOnce({ data: previewPayload() });
    const { result } = renderHook(() => usePreviewInvite("tok_123"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGet).toHaveBeenCalledWith("/invites/by-token/tok_123");
    expect(result.current.data?.status).toBe("Pending");
    expect(result.current.data?.propertyName).toBe("Maple Court");
  });

  it("surfaces an error when the token is unknown (404)", async () => {
    mockedGet.mockRejectedValueOnce(new Error("not found"));
    const { result } = renderHook(() => usePreviewInvite("nope"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("rejects a payload that doesn't match the schema", async () => {
    mockedGet.mockResolvedValueOnce({ data: { status: "Pending" } });
    const { result } = renderHook(() => usePreviewInvite("tok_123"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
