# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Corepack is used to enable pnpm
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

# Install dependencies
RUN pnpm install --filter backend...

# Copy source and build
COPY apps/backend ./apps/backend
RUN pnpm --filter backend build

# Production stage
FROM node:20-slim AS production

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

# Install only production dependencies
RUN pnpm install --prod --filter backend...

# Copy built files from builder
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

WORKDIR /app/apps/backend
EXPOSE 3000

CMD ["node", "dist/index.js"]
