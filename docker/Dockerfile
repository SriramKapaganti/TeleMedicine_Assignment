# Multi-stage production Dockerfile
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

# Dependency installation stage
FROM base AS dependencies
COPY package*.json ./
RUN npm ci --only=production

# Development stage with all dev dependencies
FROM base AS dev-dependencies
COPY package*.json ./
RUN npm ci

# Production runner image (distroless/minimal principle)
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

# Run as unprivileged user for security compliance
USER node

WORKDIR /app
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src/ ./src/
COPY --chown=node:node migrations/ ./migrations/
COPY --chown=node:node scripts/ ./scripts/
COPY --chown=node:node docs/ ./docs/

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/server.js"]
