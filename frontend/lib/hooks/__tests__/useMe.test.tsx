import { renderHook, waitFor } from "@testing-library/react";
import apiClient from "@/lib/api/client";
import { resetAuthStore } from "@/test-utils/resetAuthStore";
import useAuthStore from "@/lib/store/auth/useAuthStore";
import { renderWithQuery } from "@/test-utils/renderWithQuery";
import { useMe } from "../useMe";

jest.mock("@/lib/api/client", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

beforeEach(() => {
  resetAuthStore();
  mockedGet.mockReset();
});

describe("useMe", () => {
  it("fires the query when portal is tenant and returns name + accountStatus", async () => {
    useAuthStore.setState({ user: { portal: "tenant", sub: "s1", email: "t@dev.local" } });
    mockedGet.mockResolvedValueOnce({
      data: { firstName: "Tara", lastName: "Tenant", accountStatus: "Active" },
    });

    const { client } = renderWithQuery(<></>);
    const { QueryClientProvider } = await import("@tanstack/react-query");
    const { result } = renderHook(() => useMe(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith("/me");
    expect(result.current.data?.accountStatus).toBe("Active");
    expect(result.current.data?.firstName).toBe("Tara");
    expect(result.current.data?.lastName).toBe("Tenant");
  });

  it("fires the query for a landlord and returns the name fields", async () => {
    useAuthStore.setState({ user: { portal: "landlord", sub: "s2", email: "l@dev.local" } });
    mockedGet.mockResolvedValueOnce({
      data: { firstName: "Lara", lastName: "Landlord", accountStatus: null },
    });

    const { client } = renderWithQuery(<></>);
    const { QueryClientProvider } = await import("@tanstack/react-query");
    const { result } = renderHook(() => useMe(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith("/me");
    expect(result.current.data?.firstName).toBe("Lara");
    expect(result.current.data?.lastName).toBe("Landlord");
  });

  it("does not fire the query when there is no authenticated user", async () => {
    // resetAuthStore() (beforeEach) leaves user null.
    const { client } = renderWithQuery(<></>);
    const { QueryClientProvider } = await import("@tanstack/react-query");
    const { result } = renderHook(() => useMe(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    // Give the query a tick to (not) fire
    await new Promise((r) => setTimeout(r, 0));
    expect(mockedGet).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it("tolerates a response that omits the name fields (older contract)", async () => {
    useAuthStore.setState({ user: { portal: "tenant", sub: "s1", email: "t@dev.local" } });
    mockedGet.mockResolvedValueOnce({ data: { accountStatus: "Active" } });

    const { client } = renderWithQuery(<></>);
    const { QueryClientProvider } = await import("@tanstack/react-query");
    const { result } = renderHook(() => useMe(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.accountStatus).toBe("Active");
    expect(result.current.data?.firstName).toBeUndefined();
  });

  it("isLoading is true before the query resolves", async () => {
    useAuthStore.setState({ user: { portal: "tenant", sub: "s1", email: "t@dev.local" } });
    let resolve!: (v: unknown) => void;
    mockedGet.mockReturnValueOnce(new Promise((r) => { resolve = r; }));

    const { client } = renderWithQuery(<></>);
    const { QueryClientProvider } = await import("@tanstack/react-query");
    const { result } = renderHook(() => useMe(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    expect(result.current.isLoading).toBe(true);
    resolve({ data: { accountStatus: "Active" } });
  });
});
