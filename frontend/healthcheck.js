// healthcheck.js — Node-based liveness probe used by the compose-level
// healthcheck on the distroless image (M4.8).
//
// Why a Node script and not wget/curl:
//   gcr.io/distroless/nodejs20-debian12 ships only the Node runtime — no
//   shell, no wget, no curl, no busybox. The previous alpine-based
//   healthcheck used `wget --quiet --spider`; that path doesn't exist in
//   distroless. Same constraint that already applies to the chiseled
//   backend image (M4.2): orchestrator-level probing via K8s liveness /
//   readiness probes (M4.4) is the production path; this script keeps the
//   compose-level probe alive for local development parity.
//
// Behavior: HTTP GET against 127.0.0.1:3000/ with a 3-second timeout.
// Exits 0 on any 2xx response, non-zero on timeout / connection error /
// non-2xx status. Uses 127.0.0.1 explicitly (not localhost) — Next.js
// standalone with HOSTNAME=0.0.0.0 binds IPv4 only; resolving "localhost"
// can return ::1 first on some musl/glibc configurations and refuse the
// connection. See M4.2 scratch-log side note on the Alpine IPv6 bug.

const http = require("node:http");

const req = http.request(
  {
    host: "127.0.0.1",
    port: process.env.PORT || 3000,
    path: "/",
    method: "GET",
    timeout: 3000,
  },
  (res) => {
    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
      process.exit(0);
    }
    console.error(`healthcheck: HTTP ${res.statusCode}`);
    process.exit(1);
  },
);

req.on("timeout", () => {
  console.error("healthcheck: timeout");
  req.destroy();
  process.exit(1);
});

req.on("error", (err) => {
  console.error(`healthcheck: ${err.message}`);
  process.exit(1);
});

req.end();
