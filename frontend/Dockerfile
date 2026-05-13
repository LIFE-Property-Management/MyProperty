# =============================================================
#  frontend/Dockerfile
#
#  STATUS: VERIFICATION-GRADE — NOT PRODUCTION-READY.
#
#  This Dockerfile exists to verify that NEXT_PUBLIC_* build args
#  are correctly inlined into the Next.js bundle at build time
#  (sprint items F1, F2 from docs/audits/m3-m4-audit/dev-prod-gaps.md).
#
#  Before production deployment, the DevOps owner should harden:
#    - Switch to `output: 'standalone'` in next.config.ts and use
#      a smaller runtime stage (node:slim or distroless).
#    - Run as non-root user.
#    - Add HEALTHCHECK directive.
#    - Pin base image by digest, not tag.
#    - Layer optimization (package.json copy before source copy).
#    - .dockerignore is in place (frontend/.dockerignore).
#
#  Build context: frontend/
#  Build command:
#    docker build \
#      --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com \
#      --build-arg NEXT_PUBLIC_KEYCLOAK_URL=https://auth.example.com \
#      --build-arg NEXT_PUBLIC_KEYCLOAK_REALM=MyProperty \
#      --build-arg NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=myproperty-frontend \
#      -f frontend/Dockerfile -t myproperty-frontend:test frontend/
# =============================================================

# ── Stage 1: dependencies ────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: build ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Build args — must be declared before they can be used.
# Defaults are intentionally INVALID URLs so a build without --build-arg
# fails loudly at the requirePublicEnv() check rather than silently
# producing a broken bundle.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_KEYCLOAK_URL
ARG NEXT_PUBLIC_KEYCLOAK_REALM
ARG NEXT_PUBLIC_KEYCLOAK_CLIENT_ID

# Promote build args to env vars so `next build` sees them.
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_KEYCLOAK_URL=$NEXT_PUBLIC_KEYCLOAK_URL
ENV NEXT_PUBLIC_KEYCLOAK_REALM=$NEXT_PUBLIC_KEYCLOAK_REALM
ENV NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=$NEXT_PUBLIC_KEYCLOAK_CLIENT_ID
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ── Stage 3: runtime ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000
CMD ["npm", "start"]
