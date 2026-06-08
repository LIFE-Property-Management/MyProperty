// Manual mock for posthog-js, auto-applied by Jest to every test that imports
// it (directly or transitively through @/lib/analytics). The real SDK opens
// network connections and touches browser storage; the mock is inert and lets
// the analytics facade's unit tests assert against these jest.fn() spies.
const posthog = {
  init: jest.fn(),
  capture: jest.fn(),
  identify: jest.fn(),
  reset: jest.fn(),
  opt_in_capturing: jest.fn(),
  opt_out_capturing: jest.fn(),
  register: jest.fn(),
  __loaded: true,
};

export default posthog;
