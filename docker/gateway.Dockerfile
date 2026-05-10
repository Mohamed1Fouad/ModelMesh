FROM node:22-alpine AS base
RUN apk add --no-cache openssl

FROM base AS builder
RUN npm install -g pnpm@9.14.0 prisma@5.22.0
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/gateway ./apps/gateway
RUN pnpm install --frozen-lockfile
# Build shared packages first so gateway can import from dist
RUN pnpm run build --filter=@modelmesh/shared --filter=@modelmesh/db --filter=@modelmesh/router
# Fix workspace package exports to point to dist instead of src for production
RUN for pkg in packages/*/package.json; do \
      sed -i 's|"import": "\\./src/index\\.ts"|"import": "\\./dist/index\\.js"|g' "$pkg"; \
      sed -i 's|"types": "\\./src/index\\.ts"|"types": "\\./dist/index\\.d\\.ts"|g' "$pkg"; \
    done
RUN pnpm run build --filter=@modelmesh/gateway
# Generate Prisma client before deploy so the generated client is included
RUN pnpm --filter @modelmesh/db exec prisma generate --schema=prisma/schema.prisma
# Deploy gateway to a self-contained directory (resolves symlinks/hard links)
RUN pnpm --filter @modelmesh/gateway deploy --prod /app/deploy
# Copy generated Prisma client from builder store to deploy store
RUN cp -r /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma \
    /app/deploy/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/
# Fix deployed workspace package exports to point to dist instead of src
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
