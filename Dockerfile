# ---- Builder: compile the TanStack Start SSR app ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# No build args needed: Supabase config is injected at runtime by the SSR
# server (src/server.ts) from process.env. The build is config-agnostic.
RUN npm run build

# ---- Runner: serve the SSR build on Node ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Production deps only (no vite/eslint/etc.). The SSR build externalizes
# node_modules, so runtime deps must be installed here.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

EXPOSE 3000
CMD ["node", "server/node-server.mjs"]
