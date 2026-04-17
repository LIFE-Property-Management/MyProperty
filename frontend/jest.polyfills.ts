// Early polyfills that must be installed before the test framework loads.
// jsdom lacks TextEncoder/TextDecoder globals but many deps assume Node-style
// availability; Node's util exports are API-compatible.
import { TextEncoder, TextDecoder } from "util";

if (typeof globalThis.TextEncoder === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-global type bridge
  (globalThis as any).TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-global type bridge
  (globalThis as any).TextDecoder = TextDecoder;
}
