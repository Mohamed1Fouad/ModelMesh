# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Use pnpm. This is a pnpm workspace monorepo managed by Turbo.

- `pnpm install` — install dependencies
- `pnpm dev` — start all dev servers in parallel (gateway + dashboard)
- `pnpm build` — build all packages and apps
- `pnpm lint` — run lint across the monorepo
- `pnpm typecheck` — run TypeScript `--noEmit` across the monorepo
- `pnpm test` — run tests across the monorepo via turbo

### Package-specific commands

Use `pnpm --filter <package-name>` to target a workspace package.

- `pnpm --filter @modelmesh/gateway test` — run gateway tests (vitest run)
- `pnpm --filter @modelmesh/gateway test -- --coverage` — run with v8 coverage
- `pnpm --filter @modelmesh/router test`
- `pnpm --filter @modelmesh/dashboard test`
- `pnpm gateway:dev` — shorthand for `pnpm --filter @modelmesh/gateway dev`
- `pnpm dashboard:dev` — shorthand for `pnpm --filter @modelmesh/dashboard dev`

### Database

- `pnpm db:generate` — Prisma generate
- `pnpm db:migrate` — Prisma migrate dev
- `pnpm db:studio` — Prisma Studio

### Running a single test

```bash
pnpm --filter @modelmesh/gateway test -- tests/agents/engine.test.ts
```

## Architecture

### Monorepo layout

This is a pnpm workspace with three glob patterns: `apps/*`, `packages/*`, `plugins/**/*`.

Key packages:

- **`apps/gateway`** (`@modelmesh/gateway`) — Fastify API server. Exposes an OpenAI-compatible REST API on port 3000. Contains provider adapters, routing, auth, agents, teams, marketplace, and audit routes.
- **`apps/dashboard`** (`@modelmesh/dashboard`) — Next.js 15 App Router dashboard on port 3001. Uses Server Actions in `src/actions/*.ts` for data fetching and mutations.
- **`packages/router`** (`@modelmesh/router`) — `RouterEngine` + `HealthMonitor`. Pure TypeScript library with no framework dependencies. Scores and selects providers based on capabilities, cost, latency, health, routing rules, and local-first preference.
- **`packages/db`** (`@modelmesh/db`) — Prisma schema + client + seed. Exports `prisma` from `src/client.ts`.
- **`packages/shared`** (`@modelmesh/shared`) — Shared TypeScript types and constants (types, agent types).
- **`packages/sdk`** (`@modelmesh/sdk`) — TypeScript SDK for consumers.
- **`packages/cli`** (`@modelmesh/cli`) — CLI tool (`mm`).
- **`packages/config`** (`@modelmesh/config`) — Shared `tsconfig.base.json` and eslint preset.

### Gateway request flow

1. Client sends OpenAI-shaped request to `/v1/chat/completions`.
2. Gateway infers `taskType` and `requiredCapabilities` from the request body.
3. `RouterEngine.route()` scores all candidate providers. Rules are evaluated in priority order.
4. `createProviderAdapter(name)` returns the correct adapter (`OpenAIAdapter`, `AnthropicAdapter`, `OllamaAdapter`).
5. The adapter normalizes the request, calls the provider, and returns an OpenAI-shaped response.
6. If `stream: true`, `streamTransformer()` normalizes provider-specific chunks into `StreamingChunk`.
7. Usage is logged to PostgreSQL via Prisma in a `finally` block.
8. If the provider fails and `fallbackEnabled` is true, the top alternative is tried once.

Provider configs and routing rules are loaded from the database every 60 seconds in `server.ts`.

### Router scoring

Composite score per candidate:

```
score = capabilityMatch + costScore + latencyScore + healthBoost + ruleBoost + weightBoost + localFirstBoost
```

- Health: `healthy` +10, `degraded` -20, `unhealthy` -100 (and skipped if `healthAware: true`).
- Rules support: `route_to`, `prefer_local`, `score_boost`, `reject`, `fallback`.

### Health monitoring

`HealthMonitor` polls providers on a configurable interval. Status transitions trigger the `onStatusChange` callback. Health state is fed into `RouterEngine` before each route.

### Auth model

Two authentication paths:

1. **API key** — `X-API-Key` header. Keys are stored hashed; looked up via `prisma.apiKey.findUnique`.
2. **Bearer token** — `Authorization: Bearer <token>`. Looked up via `prisma.userSession`.

RBAC roles: `owner`, `admin`, `developer`, `viewer`, `super_admin`. Permissions are checked with `requirePermission(permission)` Fastify preHandler middleware. Every mutating request is logged by `auditLogMiddleware`.

### Database

PostgreSQL via Prisma. Key models: `Provider`, `Model`, `RoutingRule`, `UsageLog`, `HealthLog`, `ApiKey`, `User`, `Team`, `TeamMember`, `AuditLog`, `MarketplacePreset`, `Agent`, `Workflow`, `AgentSession`, `AgentMemory`.

The Prisma client is global-singleton-patterned in `packages/db/src/client.ts` to avoid multiple instances in dev.

## Conventions

### TypeScript

- `tsconfig.base.json` uses `module: "NodeNext"` and `moduleResolution: "NodeNext"`.
- All imports must use `.js` extensions, even for `.ts` files (e.g. `from "./engine.js"`).
- Files are named in `kebab-case.ts`.
- Strict mode is on. `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, and `noFallthroughCasesInSwitch` are enabled.

### Internal package imports

Internal packages are resolved via `workspace:*` in `package.json`. Consumers import them by name, e.g. `import { prisma } from "@modelmesh/db"`.

### `@modelmesh/db` test resolution

`@modelmesh/db` exports point to `./src/index.ts` (not `./dist/index.js`) so Vitest can resolve the module at test time without a pre-build step.

### Test structure

Tests live in `tests/` directories at the package root, mirroring the `src/` folder structure. They were moved out of `src/` to keep source and test separate.

- `apps/gateway/tests/`
- `apps/dashboard/tests/`
- `packages/router/tests/`

### Coverage

Vitest with `@vitest/coverage-v8`. Coverage config in each package's `vitest.config.ts`:

- `include`: `["src/**/*.ts"]`
- `exclude`: `*.d.ts`, specific files like `src/server.ts`, `src/schemas.ts`, `src/providers/base.ts` (gateway), `src/index.ts` (router), `src/lib/utils.ts` (dashboard)

Coverage aims for 100% statement coverage on included source files.

### Mocking patterns in tests

- **Prisma**: `vi.mock("@modelmesh/db", () => ({ prisma: { ... } }))`
- **Fastify routes**: Tests build a `fastify` mock that captures `get/post/put/delete` calls into a `routes` record, then invoke the handler directly.
- **Auth middleware**: `vi.mock("../../src/auth/middleware.js", () => ({ authMiddleware: vi.fn((req, rep, done) => done()), requirePermission: vi.fn((perm) => (req, rep, done) => done()) }))`
- **Dynamic imports**: Some tools in `tool-registry.ts` dynamically import `fs/promises`; tests hit catch blocks by triggering real filesystem errors (e.g. reading a directory, writing to a non-existent path).
- **Streams**: `global.fetch = vi.fn().mockResolvedValue({ ok: true, body: stream, text: async () => "" })` — the `text` method is required for no-body error paths.
- **Timers**: `vi.useFakeTimers()` + `await vi.runAllTicks()` / `await vi.advanceTimersToNextTimerAsync()` for `HealthMonitor` polling tests.

### Dashboard server actions

All dashboard data access is via Server Actions in `apps/dashboard/src/actions/*.ts`. They use `"use server"` and import `prisma` from `@modelmesh/db`. After mutations, call `revalidatePath("/...")` from `next/cache`.

### Adding a provider

1. Create adapter in `apps/gateway/src/providers/{name}.ts`.
2. Implement `ProviderAdapter` interface (`chatCompletion`, `chatCompletionStream`).
3. Register in `apps/gateway/src/providers/factory.ts`.
4. Add model records to the database.
5. Optionally add routing rules.

## Environment

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL` — PostgreSQL connection string
- `GATEWAY_PORT` — default 3000
- `CORS_ORIGIN` — default `*`
- Provider API keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OLLAMA_BASE_URL`, etc.
- `LOCAL_FIRST=true` to prefer local providers

## IDE plugins

- `apps/vscode-ext/` — TypeScript VSCode extension using `@modelmesh/sdk`. Built with `tsc`, packaged with `vsce`.
- `apps/jetbrains-plugin/` — Kotlin/Java IntelliJ plugin built with Gradle and the IntelliJ Platform Plugin.
