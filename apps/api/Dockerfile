# Production Dockerfile for Obsidian API (NestJS + Fastify)
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# Copy monorepo manifests
COPY package.json pnpm-workspace.yaml ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/permissions/package.json ./packages/permissions/
COPY packages/wings-adapter/package.json ./packages/wings-adapter/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Generate Prisma client and build packages & API
RUN pnpm --filter @obsidian/contracts build && \
    pnpm --filter @obsidian/permissions build && \
    pnpm --filter @obsidian/wings-adapter build && \
    pnpm --filter @obsidian/api prisma:generate && \
    pnpm --filter @obsidian/api build

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

ENV NODE_ENV=production

# Copy built artifacts and dependencies
COPY package.json pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
