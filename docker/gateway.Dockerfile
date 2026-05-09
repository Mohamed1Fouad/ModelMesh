FROM node:22-alpine AS base

FROM base AS builder
RUN npm install -g pnpm@9.14.0
WORKDIR /app
COPY pnpm-workspace.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/gateway ./apps/gateway
COPY apps/dashboard ./apps/dashboard
RUN pnpm install --frozen-lockfile
RUN pnpm run build --filter=@modelmesh/gateway --filter=@modelmesh/db --filter=@modelmesh/router --filter=@modelmesh/shared

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/apps/gateway/dist ./dist
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/gateway/package.json ./package.json

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]
