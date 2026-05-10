FROM node:22-alpine AS base
RUN apk add --no-cache openssl

FROM base AS builder
RUN npm install -g pnpm@9.14.0
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/dashboard ./apps/dashboard
RUN pnpm install --frozen-lockfile
# Generate Prisma client before any build that imports @modelmesh/db
RUN pnpm --filter @modelmesh/db exec prisma generate
# Build shared packages first so dashboard can import from dist
RUN pnpm run build --filter=@modelmesh/shared --filter=@modelmesh/db
# Fix workspace package exports to point to dist instead of src for production
RUN for pkg in packages/*/package.json; do \
      sed -i 's|"import": "\./src/index\.ts"|"import": "\./dist/index\.js"|g' "$pkg"; \
      sed -i 's|"types": "\./src/index\.ts"|"types": "\./dist/index\.d\.ts"|g' "$pkg"; \
    done
RUN pnpm run build --filter=@modelmesh/dashboard

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/apps/dashboard/.next/standalone ./
COPY --from=builder /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
# Copy generated Prisma client engine into standalone output
RUN mkdir -p ./node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client \
  ./node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["node", "apps/dashboard/server.js"]
