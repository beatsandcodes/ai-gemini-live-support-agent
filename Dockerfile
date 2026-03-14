# ── Build Stage ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./

# ── Production Stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S agent -u 1001 -G nodejs

# Copy from builder
COPY --from=builder --chown=agent:nodejs /app ./

USER agent

# Cloud Run uses PORT env variable
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:8080/health || exit 1

CMD ["node", "server.js"]
