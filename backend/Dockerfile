# =============================================================
#  backend/Dockerfile
#
#  STATUS: M4.2 — production-hardened.
#
#  Multi-stage build for the MyProperty .NET 10 API.
#  Runtime is mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled,
#  Canonical's distroless equivalent blessed by Microsoft.
#  No shell, no package manager, no curl. Runs as non-root UID 1654.
#
#  Build context: backend/
#  Build command (from repo root):
#    docker build -f backend/Dockerfile -t myproperty-api:dev backend/
#
#  ─────────────────────────────────────────────────────────────
#  KNOWN GAPS — closed in M4.3 or later, not M4.2:
#  ─────────────────────────────────────────────────────────────
#  • Image digest pinning. Base images use tags, not @sha256 digests.
#    M4.3 introduces Renovate/Dependabot to auto-bump digests, then
#    pins these references. Without automation, manual digest
#    lookups become stale and skip CVE patches.
#  • Trivy CVE scanning. M4.3 wires Trivy as a CI gate in
#    .github/workflows/backend-ci.yml after the image build step.
#    Local scan today:  trivy image myproperty-api:dev
#  • HEALTHCHECK directive. Chiseled images have no shell to run a
#    probe. K8s liveness/readiness probes (M4.4) handle this in
#    production; compose treats `running` as sufficient.
#
#  KNOWN GAPS — deferred indefinitely:
#  • File storage on the local filesystem. The non-root container
#    requires a one-shot init container (backend-storage-init in
#    docker-compose.yml) to chown the named volume. Cloud file
#    storage (S3/Azure Blob) eliminates the init container; see
#    CLAUDE.md "Cloud file storage: not adopted" note.
# =============================================================

# Base image digests pinned for supply-chain integrity (M4.3).
# Tags retained as human-readable labels; @sha256 is the contract.
# Bumped via Dependabot (see .github/dependabot.yml) — do not hand-edit.

# ── Stage 1: restore ──────────────────────────────────────────
# NuGet restore as its own stage so source-only changes don't
# bust the NuGet cache. We copy csproj/props files only, restore,
# then layer source in the build stage.
FROM mcr.microsoft.com/dotnet/sdk:10.0@sha256:c0790639332692a0d56cdd81ed581cfd24d040d9839764c138994866df89a3b6 AS restore
WORKDIR /src

COPY Directory.Build.props ./
COPY MyProperty.Api/MyProperty.Api.csproj MyProperty.Api/
COPY MyProperty.Application/MyProperty.Application.csproj MyProperty.Application/
COPY MyProperty.Domain/MyProperty.Domain.csproj MyProperty.Domain/
COPY MyProperty.Infrastructure/MyProperty.Infrastructure.csproj MyProperty.Infrastructure/

# Restore only the API project; ProjectReferences transitively pull
# Application/Infrastructure/Domain. Test project intentionally
# excluded (see backend/.dockerignore).
RUN dotnet restore MyProperty.Api/MyProperty.Api.csproj

# ── Stage 2: build + publish ──────────────────────────────────
FROM restore AS build
WORKDIR /src

COPY MyProperty.Api/ MyProperty.Api/
COPY MyProperty.Application/ MyProperty.Application/
COPY MyProperty.Domain/ MyProperty.Domain/
COPY MyProperty.Infrastructure/ MyProperty.Infrastructure/

RUN dotnet publish MyProperty.Api/MyProperty.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish \
    /p:UseAppHost=false

# ── Stage 3: runtime ──────────────────────────────────────────
# Chiseled = Microsoft's distroless equivalent. Built on Ubuntu
# 24.04 (Noble) chiseled base. Contains only:
#   - .NET runtime
#   - ASP.NET Core shared framework
#   - libicu (for globalization)
# No shell, no apt, no busybox, no /bin, no /usr/bin tools.
# Container runs as USER $APP_UID (= 1654) by default; no
# explicit USER directive needed but kept for clarity.
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled@sha256:f140a7fd9d0885581e70bfcc935ec1f738c30eeef04a54764db3064e60d9389e AS runtime
WORKDIR /app

# Kestrel listens on 8080 inside the container.
# Compose maps to 5042 on the host.
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

# Copy published output with explicit ownership for the non-root user.
# $APP_UID is provided by the chiseled base image (resolves to 1654).
COPY --from=build --chown=$APP_UID:$APP_UID /app/publish .

USER $APP_UID

ENTRYPOINT ["dotnet", "MyProperty.Api.dll"]
