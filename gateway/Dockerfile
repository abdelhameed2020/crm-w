# ==============================================================================
# WhatsApp Gateway - Production Dockerfile
# Multi-stage lightweight image for 24/7 WhatsApp Web (Baileys) deployment
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
RUN npm ci

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ------------------------------------------------------------------------------
# Production Runner
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Install curl/wget for healthchecks
RUN apk add --no-cache curl

# Copy production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Create storage mounts
RUN mkdir -p /app/sessions /app/uploads

ENV NODE_ENV=production
ENV GATEWAY_PORT=5001

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5001/health || exit 1

CMD ["node", "dist/index.js"]
