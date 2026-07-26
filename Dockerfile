# syntax=docker/dockerfile:1

# ---- Dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Prefer the reproducible `npm ci`; fall back to `npm install` when the lockfile
# is missing platform-specific optional deps (npm doesn't always record the full
# linux/musl native-dep subtree when the lockfile is generated on macOS).
RUN npm ci || npm install --no-audit --no-fund

# ---- Build ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined at build time, so the canonical site URL
# must be provided here (used for SEO metadata, sitemap, robots). The rest are
# optional feature switches — empty simply keeps that feature off:
#   TG_BOT_API_URL   Mini App profile sync + settings sync through the bot
#   TG_BOT_USERNAME  "Sign in with Telegram" on the plain site (Login Widget)
#   GOOGLE_CLIENT_ID Sign in with Google (identity only; bot stores settings)
# See docs/settings-sync.md.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_TG_BOT_API_URL=
ARG NEXT_PUBLIC_TG_BOT_USERNAME=
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_TG_BOT_API_URL=$NEXT_PUBLIC_TG_BOT_API_URL
ENV NEXT_PUBLIC_TG_BOT_USERNAME=$NEXT_PUBLIC_TG_BOT_USERNAME
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- Runtime ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Standalone output: a minimal server + only the deps it actually uses.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
