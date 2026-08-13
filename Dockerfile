# ── Critique HUD — Production Dockerfile ──────────────────────
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS builder
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ENV DATABASE_URL=file:./data/app.db
# Next imports route modules while collecting build metadata. The production
# database lives on a runtime-only volume, so do not initialize it here.
ENV HUD_SKIP_DATABASE_INIT=1
RUN npx prisma generate
RUN npm run build

FROM base AS runner
RUN apk add --no-cache ffmpeg
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/server.mjs ./server.mjs

# Sprite workspaces use restrictive source modes. Public assets must remain
# readable after the container drops privileges to the nextjs user.
RUN chown -R nextjs:nodejs /app/public /app/server.mjs && \
    chmod -R u=rwX,go=rX /app/public && chmod 0444 /app/server.mjs

USER nextjs
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["sh", "-c", "mkdir -p /data/audio /data/ir && node server.mjs"]
