# =============================================================
#  infrastructure/aiops-webhook/Dockerfile
#
#  AIOps webhook receiver — M4.11. Receives Alertmanager webhook
#  POSTs, calls Anthropic Claude for triage, posts to Slack.
#
#  Multi-stage build:
#    Stage 1 (deps)    — installs pinned wheels into a venv.
#    Stage 2 (runtime) — copies the venv on top of python:3.12-slim,
#                        drops to a non-root user, runs uvicorn.
#
#  Final image: ~95 MB. All dependencies (fastapi, anthropic, httpx,
#  pydantic-core) ship pre-built wheels for linux/amd64+arm64; no
#  C toolchain needed in either stage.
# =============================================================

# ── Stage 1: build venv ──────────────────────────────────────
FROM python:3.12.13-slim AS deps
WORKDIR /build

ENV VENV_PATH=/opt/aiops-venv
RUN python -m venv "$VENV_PATH"
ENV PATH="$VENV_PATH/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Stage 2: runtime ─────────────────────────────────────────
FROM python:3.12.13-slim AS runtime

# Non-root user, in the spirit of M4.2 / M4.8 hardening even though
# this file lives outside the API/frontend production Dockerfile scope.
RUN groupadd --system aiops \
    && useradd --system --gid aiops --home /app --shell /sbin/nologin aiops

WORKDIR /app

ENV VENV_PATH=/opt/aiops-venv
ENV PATH="$VENV_PATH/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

COPY --from=deps "$VENV_PATH" "$VENV_PATH"
COPY main.py .

# python -c probe — slim base ships neither curl nor wget, and Python
# is already present. Treats any non-200 as unhealthy.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=10 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5001/health', timeout=3)"

USER aiops
EXPOSE 5001

# Single worker is intentional — alert volume is sparse, and a single
# in-process worker keeps the design simple (no shared state across
# workers, no need for a process manager). Scale via replicas in K8s
# if alert throughput ever grows beyond what one worker handles.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5001", "--workers", "1"]
