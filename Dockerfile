# Stage 1: Install dependencies
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Stage 2: Build the application
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time.
# Coolify auto-injects ARG declarations for any env var flagged as build-time,
# but we declare them here too so local `docker build` works without Coolify.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID
ARG NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID=${NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID} \
    NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID=${NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID} \
    NEXT_PUBLIC_POSTHOG_HOST=${NEXT_PUBLIC_POSTHOG_HOST} \
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=${NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN}

RUN pnpm build

# Stage 3: Production runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NUNCIO_DATA_DIR=/app/.data

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN mkdir -p /app/.data && chown nextjs:nodejs /app/.data

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
