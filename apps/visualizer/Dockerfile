# Build stage
FROM node:20-slim AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/visualizer/package.json ./apps/visualizer/

# Install dependencies
RUN pnpm install --filter visualizer...

# Copy source and build
COPY apps/visualizer ./apps/visualizer
RUN pnpm --filter visualizer build

# Production stage
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/apps/visualizer/dist /usr/share/nginx/html

# Copy nginx config if needed (optional, default is fine for simple SPA)
# COPY apps/visualizer/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
