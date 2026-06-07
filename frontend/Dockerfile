# =============================================================
#  frontend/Dockerfile
#
#  STATUS: M4.8 — distroless runtime.
#
#  Multi-stage build for the MyProperty Next.js frontend.
#  Runtime is gcr.io/distroless/nodejs20-debian12 running as the
#  built-in non-root `nonroot` user (UID 65532). Builder stages
#  use node:20-alpine (full Node + npm + shell available there).
#
#  Build context: frontend/
#  Build command:
#    docker build \
#      --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com \
#      --build-arg NEXT_PUBLIC_KEYCLOAK_URL=https://auth.example.com \
#      --build-arg NEXT_PUBLIC_KEYCLOAK_REALM=MyProperty \
#      --build-arg NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=myproperty-frontend \
#      -f frontend/Dockerfile -t myproperty-frontend:dev frontend/
#
#  ─────────────────────────────────────────────────────────────
#  M4.8 hardening notes:
#  ─────────────────────────────────────────────────────────────
#  • Distroless runtime — no shell, no busybox, no package manager.
#    Same hardening posture as the chiseled backend image. K8s probes
#    (httpGet from the kubelet) handle health checks in production;
#    compose-level probe uses the bundled `node` to run healthcheck.mjs.
#  • Trivy CVE scanning is a CI quality gate. See .trivyignore at repo
#    root for the triage workflow.
#  • Local scan:  trivy image myproperty-frontend:dev
#
#  KNOWN GAPS — deferred indefinitely:
#  • MockProvider/msw dead code in standalone bundle. Layouts import
#    MockProvider unconditionally; tracer pulls msw into runtime
#    deps. ~10 MB wasted, no runtime impact (MockProvider gates on
#    NODE_ENV !== 'production'). Cleanup batched with audit F3
#    follow-up post-M4.
# =============================================================

# Base image digests pinned for supply-chain integrity (M4.3).
# Tags retained as human-readable labels; @sha256 is the contract.
# Bumped via Dependabot (see .github/dependabot.yml) — do not hand-edit.

# ── Stage 1: dependencies ────────────────────────────────────
# Isolated stage for npm ci so source-only changes don't bust
# the layer cache. node_modules from this stage flows into the
# builder stage; runtime never sees the full tree.
FROM node:26-alpine@sha256:144769ec3f32e8ee36b3cfde91e82bee25d9367b20f31a151f3f7eea3a2a8541 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: build ───────────────────────────────────────────
FROM node:26-alpine@sha256:144769ec3f32e8ee36b3cfde91e82bee25d9367b20f31a151f3f7eea3a2a8541 AS builder
WORKDIR /app

# Build args — NEXT_PUBLIC_* vars are inlined into the bundle
# at build time. Missing args trigger the requirePublicEnv()
# runtime guard during `next build`, failing the build loudly.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_KEYCLOAK_URL
ARG NEXT_PUBLIC_KEYCLOAK_REALM
ARG NEXT_PUBLIC_KEYCLOAK_CLIENT_ID
# Optional local-only mock-auth toggle. When set to "true", proxy.ts and the
# two KeycloakInit components short-circuit auth and stamp a fixture identity.
# Wired through docker-compose for local dev. Must remain unset in CI and deploys.
ARG NEXT_PUBLIC_DEV_AUTH_BYPASS

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_KEYCLOAK_URL=$NEXT_PUBLIC_KEYCLOAK_URL \
    NEXT_PUBLIC_KEYCLOAK_REALM=$NEXT_PUBLIC_KEYCLOAK_REALM \
    NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=$NEXT_PUBLIC_KEYCLOAK_CLIENT_ID \
    NEXT_PUBLIC_DEV_AUTH_BYPASS=$NEXT_PUBLIC_DEV_AUTH_BYPASS \
    NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ── Stage 3: runtime ─────────────────────────────────────────
# Distroless nodejs20-debian12 ships only the Node runtime.
# Ships a built-in `nonroot` user (UID 65532). No shell, no
# busybox, no curl, no package manager. ENTRYPOINT defaults to
# /nodejs/bin/node — pass the script path as CMD.
#
# Standalone output structure:
#   /.next/standalone/         <- server.js + traced node_modules
#   /.next/static/             <- static chunks (must be copied separately)
#   /public/                   <- static assets (must be copied separately)
# Digest pinned for supply-chain integrity (M4.3). Bumped via Dependabot.
FROM gcr.io/distroless/nodejs20-debian12:nonroot@sha256:2cd820156cf039c8b54ae2d2a97e424b6729070714de8707a6b79f20d56f6a9a AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# nonroot in distroless is UID 65532. Chown to that.
COPY --from=builder --chown=65532:65532 /app/.next/standalone ./
COPY --from=builder --chown=65532:65532 /app/.next/static ./.next/static
COPY --from=builder --chown=65532:65532 /app/public ./public
# healthcheck.mjs is an ES module (.mjs extension is the explicit marker —
# frontend/package.json has no "type": "module"). Compose invokes it via
# the node binary at /nodejs/bin/node; the Node runtime selects the loader
# based on the file extension.
COPY --from=builder --chown=65532:65532 /app/healthcheck.mjs ./healthcheck.mjs

# The base image already runs as `nonroot`; the explicit USER line is
# kept for clarity and to satisfy security scanners that grep for it.
USER nonroot

EXPOSE 3000

# No HEALTHCHECK directive — distroless has no shell to run a CMD-SHELL
# probe, and Docker's "CMD ["node", "healthcheck.mjs"]" form would shadow
# our actual entrypoint sequence. Compose-level healthcheck wires the
# node-based probe externally; K8s probes (M4.4) run httpGet from the
# kubelet. Same K8s-native pattern as the chiseled backend image.

# Distroless nodejs ENTRYPOINT is the node binary, so CMD passes
# server.js as the first argv to node. Standalone emits server.js at
# the working directory root.
CMD ["server.js"]
