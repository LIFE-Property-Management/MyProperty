import { render } from "@testing-library/react";
import { AnalyticsProvider } from "../AnalyticsProvider";
import useAuthStore from "@/lib/store/auth/useAuthStore";
import { capturePageview, identifyUser, initAnalytics, resetUser } from "@/lib/analytics";

// Route hooks are mocked so the pageview tracker has a deterministic URL.
jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/properties",
  useSearchParams: () => new URLSearchParams("page=2"),
}));

// The facade is mocked: this test verifies the provider WIRES the facade, not
// what PostHog does with the calls (that's posthog.test.ts).
jest.mock("@/lib/analytics", () => ({
  __esModule: true,
  initAnalytics: jest.fn(),
  capturePageview: jest.fn(),
  identifyUser: jest.fn(),
  resetUser: jest.fn(),
}));

const mockedInit = initAnalytics as jest.Mock;
const mockedPageview = capturePageview as jest.Mock;
const mockedIdentify = identifyUser as jest.Mock;
const mockedReset = resetUser as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.getState().clearAuth();
});

describe("AnalyticsProvider", () => {
  it("initialises analytics once on mount", () => {
    render(<AnalyticsProvider />);
    expect(mockedInit).toHaveBeenCalledTimes(1);
  });

  it("captures a pageview with the absolute URL including query string", () => {
    render(<AnalyticsProvider />);
    expect(mockedPageview).toHaveBeenCalledWith(
      `${window.location.origin}/dashboard/properties?page=2`,
    );
  });

  it("identifies the user when authenticated", () => {
    useAuthStore.getState().setAuth({
      portal: "landlord",
      sub: "sub-abc",
      email: "owner@example.com",
    });

    render(<AnalyticsProvider />);

    expect(mockedIdentify).toHaveBeenCalledWith("sub-abc", {
      portal: "landlord",
      email: "owner@example.com",
    });
    expect(mockedReset).not.toHaveBeenCalled();
  });

  it("resets identity when there is no user", () => {
    render(<AnalyticsProvider />);
    expect(mockedReset).toHaveBeenCalled();
    expect(mockedIdentify).not.toHaveBeenCalled();
  });
});
