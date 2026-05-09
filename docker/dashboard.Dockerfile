FROM node:22-alpine AS base

FROM base AS builder
RUN npm install -g pnpm@9.14.0
WORKDIR /app
COPY pnpm-workspace.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/dashboard ./apps/dashboard
RUN pnpm install --frozen-lockfile
RUN pnpm run build --filter=@modelmesh/dashboard

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/apps/dashboard/.next/standalone ./
COPY --from=builder /app/apps/dashboard/.next/static ./.next/static
COPY --from=builder /app/apps/dashboard/public ./public

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["node", "server.js"]
