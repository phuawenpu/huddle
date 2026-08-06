FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.20.0 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml* ./
COPY packages/backend/package.json ./packages/backend/
RUN pnpm install --frozen-lockfile --filter backend

FROM base AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/backend/node_modules ./packages/backend/node_modules
COPY . .
WORKDIR /app/packages/backend
CMD ["pnpm", "dev"]
