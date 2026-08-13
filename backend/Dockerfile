# Multi-stage Dockerfile for Backend API
FROM node:22-slim AS builder

WORKDIR /app

# Install OpenSSL required by Prisma Client
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV DATABASE_URL="file:./dev.db"

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY prisma ./prisma/
RUN npx prisma generate
RUN npx prisma db push --accept-data-loss

COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# Production Runner Stage
FROM node:22-slim AS runner

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_URL="file:./dev.db"

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/server.js"]
