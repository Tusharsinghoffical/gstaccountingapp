# ============================================================================
# GST Ledger — Multi-Stage Docker Build (Next.js 14 Standalone)
# ============================================================================
#
# Stages:
#   1. deps    — install production + dev dependencies
#   2. builder — compile Next.js with output: standalone
#   3. runner  — minimal production image (~200 MB vs ~1 GB naive build)
#
# Build:  docker build -t gst-ledger .
# Run:    docker run -p 3000:3000 --env-file .env.local gst-ledger
# ============================================================================

# ----- Stage 1: Install dependencies ----------------------------------------
FROM node:20-alpine AS deps

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine
# to understand why libc6-compat may be needed.
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy only the lockfile first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ----- Stage 2: Build the application ----------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Bring in all deps (including devDeps for the build step)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client for Linux
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=1

RUN npm run build

# ----- Stage 3: Minimal production runner ------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Default port — override with -e PORT=xxxx at runtime
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs \
    && adduser  --system --uid 1001 nextjs

# Copy only the standalone output from builder
# next.config.mjs must have output: "standalone"
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static   ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

USER nextjs

EXPOSE 3000

# server.js is emitted by Next.js standalone output
CMD ["node", "server.js"]