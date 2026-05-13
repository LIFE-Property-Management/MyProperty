/**
 * Reads a NEXT_PUBLIC_* environment variable with explicit failure modes.
 *
 * IMPORTANT — bundler constraint:
 * Next.js (both webpack and turbopack) only inlines NEXT_PUBLIC_* env reads
 * into the client bundle when they appear in source as LITERAL property
 * accesses: process.env.NEXT_PUBLIC_FOO. Any indirection — process.env[name],
 * optional chaining, destructuring — defeats the static analysis and leaves
 * the access as a runtime lookup against an empty client-side env object,
 * which always returns undefined.
 *
 * That's why every literal access lives in the lookup table below. Adding a
 * new NEXT_PUBLIC_* var requires one line here AND --build-arg in the
 * Dockerfile.
 *
 * Behavior:
 *   - Production build with var missing → throws immediately.
 *   - Dev / test with var missing → warns once, returns empty string.
 * The dev-tolerant behavior is intentional (MSW intercepts relative URLs;
 * Keycloak is skipped when NEXT_PUBLIC_DEV_AUTH_BYPASS=true).
 */

const PUBLIC_ENV_READERS = {
  NEXT_PUBLIC_API_BASE_URL: () => process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_KEYCLOAK_URL: () => process.env.NEXT_PUBLIC_KEYCLOAK_URL,
  NEXT_PUBLIC_KEYCLOAK_REALM: () => process.env.NEXT_PUBLIC_KEYCLOAK_REALM,
  NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: () => process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID,
} as const;

export type PublicEnvName = keyof typeof PUBLIC_ENV_READERS;

export function requirePublicEnv(name: PublicEnvName): string {
  const value = PUBLIC_ENV_READERS[name]();
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `${name} must be set at build time for production builds. ` +
          `For Docker builds, pass it via --build-arg ${name}=<value>.`
      );
    }
    if (typeof console !== "undefined") {
      console.warn(`${name} is not set; using empty string fallback.`);
    }
    return "";
  }
  return value;
}
