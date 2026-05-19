# =============================================================
#  frontend/Dockerfile
#
#  STATUS: M4.2 — production-hardened.
#
#  Multi-stage build for the MyProperty Next.js frontend.
#  Runtime is node:20-alpine running as non-root `node` user.
#  Uses Next.js standalone output for ~90% smaller image vs
#  shipping the full node_modules tree.
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
#  KNOWN GAPS — closed in M4.3 or later, not M4.2:
#  ─────────────────────────────────────────────────────────────
#  • Image digest pinning. Base images use tags, not @sha256 digests.
#    M4.3 introduces Renovate/Dependabot to auto-bump digests, then
#    pins these references.
#  • Trivy CVE scanning. M4.3 wires Trivy as a CI gate in
#    .github/workflows/frontend-ci.yml after the image build step.
#    Local scan today:  trivy image myproperty-frontend:dev
#
#  KNOWN GAPS — deferred indefinitely:
#  • MockProvider/msw dead code in standalone bundle. Layouts import
#    MockProvider unconditionally; tracer pulls msw into runtime
#    deps. ~10 MB wasted, no runtime impact (MockProvider gates on
#    NODE_ENV !== 'production'). Cleanup batched with audit F3
#    follow-up post-M4.
# =============================================================

# ── Stage 1: dependencies ────────────────────────────────────
# Isolated stage for npm ci so source-only changes don't bust
# the layer cache. node_modules from this stage flows into the
# builder stage; runtime never sees the full tree.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: build ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Build args — NEXT_PUBLIC_* vars are inlined into the bundle
# at build time. Missing args trigger the requirePublicEnv()
# runtime guard during `next build`, failing the build loudly.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_KEYCLOAK_URL
ARG NEXT_PUBLIC_KEYCLOAK_REALM
ARG NEXT_PUBLIC_KEYCLOAK_CLIENT_ID

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_KEYCLOAK_URL=$NEXT_PUBLIC_KEYCLOAK_URL \
    NEXT_PUBLIC_KEYCLOAK_REALM=$NEXT_PUBLIC_KEYCLOAK_REALM \
    NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=$NEXT_PUBLIC_KEYCLOAK_CLIENT_ID \
    NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ── Stage 3: runtime ─────────────────────────────────────────
# node:20-alpine ships a built-in non-root `node` user (UID 1000).
# Standalone output emits a minimal server.js + only the node_modules
# actually traced at build time. Static assets and public/ are
# copied separately.
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Standalone output structure:
#   /.next/standalone/         <- server.js + traced node_modules
#   /.next/static/             <- static chunks (must be copied separately)
#   /public/                   <- static assets (must be copied separately)
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node

EXPOSE 3000

# Dockerfile-level HEALTHCHECK — alpine has wget, so we keep this
# alongside the compose-level probe. K8s probes (M4.4) take over in
# production.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:3000/ || exit 1

# Standalone emits server.js at the working directory root.
# No `npm start`, no package.json scripts — just node directly.
CMD ["node", "server.js"]
