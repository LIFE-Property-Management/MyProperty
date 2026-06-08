/**
 * Unit tests for the PostHog facade. The posthog-js SDK is auto-mocked via
 * frontend/__mocks__/posthog-js.ts. Each test resets the module registry so the
 * facade's internal `initialized` flag starts fresh, and sets/unsets the env var
 * that gates initialisation.
 */
import { ANALYTICS_EVENTS } from "../events";

const KEY_ENV = "NEXT_PUBLIC_POSTHOG_KEY";
const HOST_ENV = "NEXT_PUBLIC_POSTHOG_HOST";

const originalEnv = { ...process.env };

// Loads a fresh copy of the facade plus the posthog-js mock instance bound to
// the same module-registry generation, so spies and the facade agree.
function loadFacade() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- fresh module per test
  const posthog = require("posthog-js").default as Record<string, jest.Mock>;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- fresh module per test
  const facade = require("../posthog") as typeof import("../posthog");
  return { posthog, facade };
}

beforeEach(() => {
  jest.resetModules();
  delete process.env[KEY_ENV];
  delete process.env[HOST_ENV];
});

afterAll(() => {
  process.env = originalEnv;
});

describe("analytics facade — unconfigured (no key)", () => {
  it("does not initialise and reports disabled", () => {
    const { posthog, facade } = loadFacade();

    facade.initAnalytics();

    expect(posthog.init).not.toHaveBeenCalled();
    expect(facade.isAnalyticsEnabled()).toBe(false);
  });

  it("makes every emit a silent no-op", () => {
    const { posthog, facade } = loadFacade();

    facade.initAnalytics();
    facade.capture(ANALYTICS_EVENTS.signupStarted);
    facade.capture(ANALYTICS_EVENTS.propertyCreated, { propertyType: "Apartment" });
    facade.identifyUser("user-1", { portal: "landlord", email: "a@b.com" });
    facade.resetUser();
    facade.capturePageview("http://localhost/");

    expect(posthog.capture).not.toHaveBeenCalled();
    expect(posthog.identify).not.toHaveBeenCalled();
    expect(posthog.reset).not.toHaveBeenCalled();
  });
});

describe("analytics facade — configured (key present)", () => {
  it("initialises PostHog with the key and a default EU host", () => {
    process.env[KEY_ENV] = "phc_test_key";
    const { posthog, facade } = loadFacade();

    facade.initAnalytics();

    expect(facade.isAnalyticsEnabled()).toBe(true);
    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test_key",
      expect.objectContaining({
        api_host: "https://eu.i.posthog.com",
        capture_pageview: false,
      }),
    );
  });

  it("disables autocapture so only explicit typed events are sent", () => {
    process.env[KEY_ENV] = "phc_test_key";
    const { posthog, facade } = loadFacade();

    facade.initAnalytics();

    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test_key",
      expect.objectContaining({ autocapture: false }),
    );
  });

  it("honours a custom host", () => {
    process.env[KEY_ENV] = "phc_test_key";
    process.env[HOST_ENV] = "https://us.i.posthog.com";
    const { posthog, facade } = loadFacade();

    facade.initAnalytics();

    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test_key",
      expect.objectContaining({ api_host: "https://us.i.posthog.com" }),
    );
  });

  it("only initialises once", () => {
    process.env[KEY_ENV] = "phc_test_key";
    const { posthog, facade } = loadFacade();

    facade.initAnalytics();
    facade.initAnalytics();

    expect(posthog.init).toHaveBeenCalledTimes(1);
  });

  it("forwards typed events, identify, reset and pageview", () => {
    process.env[KEY_ENV] = "phc_test_key";
    const { posthog, facade } = loadFacade();
    facade.initAnalytics();

    facade.capture(ANALYTICS_EVENTS.propertyCreated, { propertyType: "House" });
    facade.identifyUser("sub-123", { portal: "tenant", email: "t@example.com" });
    facade.resetUser();
    facade.capturePageview("http://localhost/dashboard");

    expect(posthog.capture).toHaveBeenCalledWith("property_created", {
      propertyType: "House",
    });
    expect(posthog.identify).toHaveBeenCalledWith("sub-123", {
      portal: "tenant",
      email: "t@example.com",
    });
    expect(posthog.reset).toHaveBeenCalledTimes(1);
    expect(posthog.capture).toHaveBeenCalledWith("$pageview", {
      $current_url: "http://localhost/dashboard",
    });
  });
});
