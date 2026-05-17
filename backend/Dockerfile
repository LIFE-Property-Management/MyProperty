# =============================================================
#  backend/Dockerfile
#
#  STATUS: FUNCTIONAL — NOT YET HARDENED.
#
#  Multi-stage build for the MyProperty .NET 10 API. Brings the
#  service up inside docker compose for M4.1. The DevOps owner
#  hardens to production grade in M4.2:
#    - Non-root user.
#    - Distroless / chiseled runtime base image.
#    - Trivy scan as CI gate.
#    - Pin base images by digest, not tag.
#    - HEALTHCHECK directive.
#
#  Build context: backend/   (matches frontend/Dockerfile convention
#                 and the existing backend/.dockerignore).
#  Build command (from repo root):
#    docker build -f backend/Dockerfile -t myproperty-api:dev backend/
# =============================================================

# ── Stage 1: restore ──────────────────────────────────────────
# Restoring as its own stage lets Docker cache the NuGet graph
# across rebuilds where only source files change. We copy just
# the csproj/props files first, restore, then layer source on
# top in the build stage.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS restore
WORKDIR /src

# Directory.Build.props applies to every csproj in this tree.
COPY Directory.Build.props ./
COPY MyProperty.Api/MyProperty.Api.csproj MyProperty.Api/
COPY MyProperty.Application/MyProperty.Application.csproj MyProperty.Application/
COPY MyProperty.Domain/MyProperty.Domain.csproj MyProperty.Domain/
COPY MyProperty.Infrastructure/MyProperty.Infrastructure.csproj MyProperty.Infrastructure/

# Restore only the API project — its <ProjectReference>s pull
# Application / Infrastructure / Domain into the graph transitively.
# Test project is intentionally excluded (see backend/.dockerignore).
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
# aspnet:10.0 is the minimal ASP.NET Core runtime image.
# M4.2 swaps this for a chiseled / distroless variant.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# curl is used by the compose-level HEALTHCHECK to probe /api/v1/health/live.
# Adds ~2 MB to the image; M4.2 removes both (chiseled images don't have a
# shell anyway, so the healthcheck moves into the orchestrator probe).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Kestrel listens on 8080 inside the container. Compose maps this
# to 5042 on the host so the URL matches launchSettings.json and
# the frontend env example (NEXT_PUBLIC_API_BASE_URL=http://localhost:5042).
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "MyProperty.Api.dll"]
