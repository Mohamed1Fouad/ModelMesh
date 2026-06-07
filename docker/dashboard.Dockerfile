FROM node:22-alpine AS base
RUN apk add --no-cache openssl

FROM base AS builder
RUN npm install -g pnpm@9.14.0
WORKDIR /app

# 1. Copy workspace root files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./

# 2. Copy only package.json files for workspace resolution
#    This layer is cached unless package.json or pnpm-lock.yaml changes
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/config/package.json ./packages/config/
COPY apps/dashboard/package.json ./apps/dashboard/

# 3. Install dependencies — cached on subsequent source-only changes
RUN pnpm install --frozen-lockfile

# 4. Copy full source code — changes here don't bust the install layer
COPY packages ./packages
COPY apps/dashboard ./apps/dashboard

# 5. Generate Prisma client before any build that imports @modelmesh/db
RUN pnpm --filter @modelmesh/db exec prisma generate

# 6. Build shared packages first so dashboard can import from dist
RUN pnpm run build --filter=@modelmesh/shared --filter=@modelmesh/db

# 7. Fix workspace package exports to point to dist instead of src for production
RUN for pkg in packages/*/package.json; do \
      sed -i 's|"import": "\./src/index\.ts"|"import": "\./dist/index\.js"|g' "$pkg"; \
      sed -i 's|"types": "\./src/index\.ts"|"types": "\./dist/index\.d\.ts"|g' "$pkg"; \
    done

ENV GATEWAY_URL=http://gateway:3000
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
