FROM node:22-alpine AS base
RUN apk add --no-cache openssl

FROM base AS builder
RUN npm install -g pnpm@9.14.0 prisma@5.22.0
WORKDIR /app

# 1. Copy workspace root files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./

# 2. Copy only package.json files for workspace resolution
#    This layer is cached unless package.json or pnpm-lock.yaml changes
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/router/package.json ./packages/router/
COPY packages/config/package.json ./packages/config/
COPY apps/gateway/package.json ./apps/gateway/

# 3. Install dependencies — cached on subsequent source-only changes
RUN pnpm install --frozen-lockfile

# 4. Copy full source code — changes here don't bust the install layer
COPY packages ./packages
COPY apps/gateway ./apps/gateway

# 5. Build shared packages first so gateway can import from dist
RUN pnpm run build --filter=@modelmesh/shared --filter=@modelmesh/db --filter=@modelmesh/router

# 6. Fix workspace package exports to point to dist instead of src for production
RUN for pkg in packages/*/package.json; do \
      sed -i 's|"import": "\\./src/index\\.ts"|"import": "\\./dist/index\\.js"|g' "$pkg"; \
      sed -i 's|"types": "\\./src/index\\.ts"|"types": "\\./dist/index\\.d\\.ts"|g' "$pkg"; \
    done

RUN pnpm run build --filter=@modelmesh/gateway

# 7. Generate Prisma client before deploy so the generated client is included
RUN pnpm --filter @modelmesh/db exec prisma generate --schema=prisma/schema.prisma

# 8. Deploy gateway to a self-contained directory (resolves symlinks/hard links)
RUN pnpm --filter @modelmesh/gateway deploy --prod /app/deploy

# 9. Copy generated Prisma client from builder store to deploy store
RUN cp -r /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma \
    /app/deploy/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/

# 10. Fix deployed workspace package exports to point to dist instead of src
RUN find /app/deploy -path '*/node_modules/@modelmesh/*/package.json' | while read pkg; do \
      sed -i 's|"import": "./src/index.ts"|"import": "./dist/index.js"|g' "$pkg"; \
      sed -i 's|"types": "./src/index.ts"|"types": "./dist/index.d.ts"|g' "$pkg"; \
    done
RUN find /app/deploy/packages -name package.json | while read pkg; do \
      sed -i 's|"import": "./src/index.ts"|"import": "./dist/index.js"|g' "$pkg"; \
      sed -i 's|"types": "./src/index.ts"|"types": "./dist/index.d.ts"|g' "$pkg"; \
    done

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/deploy .

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]
