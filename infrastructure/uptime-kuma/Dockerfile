# =============================================================
#  infrastructure/uptime-kuma/Dockerfile
#
#  Uptime Kuma seed sidecar — M4.6. Idempotent one-shot that
#  bootstraps the admin account, notification channels, monitors,
#  and the public status page on a fresh Kuma volume. Subsequent
#  runs detect the existing admin and short-circuit to a no-op.
#
#  Same multi-stage shape as infrastructure/aiops-webhook/Dockerfile
#  so the Trivy + digest-pinning patterns from M4.3 carry over
#  unchanged. Final image: ~75 MB.
# =============================================================

# Base image digests pinned for supply-chain integrity (M4.3).
# Tags retained as human-readable labels; @sha256 is the contract.
# Bumped via Dependabot (see .github/dependabot.yml) — do not hand-edit.

# ── Stage 1: build venv ──────────────────────────────────────
FROM python:3.14-slim@sha256:d7a925f9eb9639a93e455b9f12c167569358818c0f62b51b88edbc8fcf34c421 AS deps
WORKDIR /build

ENV VENV_PATH=/opt/kuma-seed-venv
RUN python -m venv "$VENV_PATH"
ENV PATH="$VENV_PATH/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Stage 2: runtime ─────────────────────────────────────────
FROM python:3.14-slim@sha256:d7a925f9eb9639a93e455b9f12c167569358818c0f62b51b88edbc8fcf34c421 AS runtime

# Non-root user — the seed script only needs outbound HTTP/socket.io to Kuma,
# no filesystem writes, so the principle-of-least-privilege swap is essentially
# free.
RUN groupadd --system kuma \
    && useradd --system --gid kuma --home /app --shell /sbin/nologin kuma

WORKDIR /app

ENV VENV_PATH=/opt/kuma-seed-venv
ENV PATH="$VENV_PATH/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

COPY --from=deps "$VENV_PATH" "$VENV_PATH"
COPY seed.py monitors.json ./

USER kuma

# One-shot: the script exits 0 after seeding (or no-op on re-run). No
# HEALTHCHECK directive — compose treats `restart: "no"` containers as
# "completed" once they exit, and that's the correct semantic here.
ENTRYPOINT ["python", "seed.py"]
