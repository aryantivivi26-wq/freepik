# ══════════════════════════════════════════════════════
#  Telegram AI Generator Bot — Production Dockerfile
#  Supports: Coolify, Docker Compose, standalone Docker
# ══════════════════════════════════════════════════════

FROM node:20-alpine AS base

# Labels for Coolify / container registries
LABEL maintainer="AI Generator Bot"
LABEL org.opencontainers.image.title="telegram-ai-generator-bot"
LABEL org.opencontainers.image.description="Telegram AI Generator Bot with Freepik API and QRIS Payment"

# Install tini for proper signal handling (PID 1)
RUN apk add --no-cache tini

WORKDIR /app

# ── Install dependencies (cached layer) ──────────────
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Copy source code ─────────────────────────────────
COPY src/ ./src/

# ── Create non-root user & required dirs ─────────────
RUN addgroup -S botgroup && adduser -S botuser -G botgroup \
    && mkdir -p uploads temp logs \
    && chown -R botuser:botgroup /app

USER botuser

# ── Expose webhook server port ───────────────────────
EXPOSE 3001

# ── Health check ─────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${WEBHOOK_PORT:-3001}/health || exit 1

# ── Default: start bot (override with docker-compose) ─
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
