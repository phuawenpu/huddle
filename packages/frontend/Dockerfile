FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.20.0 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml* ./
COPY packages/frontend/package.json ./packages/frontend/
RUN pnpm install --frozen-lockfile --filter frontend

FROM base AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/frontend/node_modules ./packages/frontend/node_modules
COPY . .
WORKDIR /app/packages/frontend
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
