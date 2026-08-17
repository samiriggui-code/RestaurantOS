# ===== Stage 1: Builder =====
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install ALL dependencies (including devDeps for build)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client and build
RUN npx prisma generate
RUN npm run build

# ===== Stage 2: Runner =====
FROM node:20-alpine AS runner

# Create non-root user for security
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# Copy only production-necessary artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

RUN mkdir -p /app/backups /app/uploads /app/data/fiscal-archives /traefik-dynamic \
  && chown -R app:app /app/backups /app/uploads /app/data /traefik-dynamic

# Switch to non-root user
USER app

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "dist/index.js"]
