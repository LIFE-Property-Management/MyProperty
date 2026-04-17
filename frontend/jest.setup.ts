import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

// Next.js font imports expand to CSS variables in the root layout. The next/jest
// transformer inlines stubs for next/font/google, but components that read
// navigator.language (e.g. Intl formatters in LeaseSummaryCard) need a stable
// locale so snapshot-style text assertions don't drift between machines.
Object.defineProperty(window.navigator, "language", {
  value: "en-US",
  configurable: true,
});

// IntersectionObserver and ResizeObserver are not implemented in jsdom; several
// Framer Motion layout utilities reference them. Stub with no-ops.
class NoopObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return [];
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-global type bridge
(globalThis as any).IntersectionObserver = NoopObserver;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-global type bridge
(globalThis as any).ResizeObserver = NoopObserver;

// matchMedia is used by prefers-reduced-motion checks inside framer-motion.
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// Node 20 jsdom has crypto.randomUUID in most builds but we assert it to keep
// the notificationSlice's id generation deterministic in tests.
if (!globalThis.crypto || typeof globalThis.crypto.randomUUID !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamic node built-in under jsdom
  const nodeCrypto = require("node:crypto") as { webcrypto: Crypto };
  Object.defineProperty(globalThis, "crypto", {
    value: nodeCrypto.webcrypto,
    configurable: true,
  });
}
