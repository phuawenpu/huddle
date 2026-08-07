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
RUN npx prisma generate
RUN npm run build

FROM base AS runner
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy prisma CLI and regenerate client for production
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma/engines ./node_modules/@prisma/engines

RUN mkdir -p /data/audio /data/ir
RUN chown -R nextjs:nodejs /app /data

USER nextjs
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

# Startup script: init DB, then start server
CMD sh -c "npx prisma db push --skip-generate && node server.js"
