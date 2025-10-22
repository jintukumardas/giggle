# Multi-stage build for Giggle API

FROM node:18-alpine AS base
RUN npm install -g pnpm@8.15.0

FROM base AS dependencies
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/agents/package.json ./packages/agents/
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY . .
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/api/node_modules ./apps/api/node_modules
RUN pnpm build

FROM base AS production
WORKDIR /app

# Copy built application
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./
COPY --from=build /app/node_modules ./node_modules

# Copy database migration script
COPY --from=build /app/apps/api/scripts ./scripts
COPY --from=build /app/apps/api/src/db ./src/db

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run migrations and start server
CMD ["sh", "-c", "pnpm tsx scripts/migrate.ts && node dist/index.js"]
