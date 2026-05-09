# Contributing to ModelMesh

Thank you for your interest in contributing! ModelMesh is an open-source project built by and for developers.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/modelmesh.git`
3. Install dependencies: `pnpm install`
4. Copy `.env.example` to `.env` and configure
5. Start the database: `docker compose -f docker/docker-compose.yml up -d postgres redis`
6. Run migrations: `pnpm db:migrate`
7. Start dev: `pnpm dev`

## Development Workflow

- **Branch**: Create a feature branch from `main`
- **Code**: Follow existing TypeScript patterns
- **Test**: Add tests for new logic
- **Lint**: `pnpm lint`
- **Typecheck**: `pnpm typecheck`
- **Commit**: Use conventional commits (`feat:`, `fix:`, `docs:`, etc.)
- **PR**: Open a pull request with a clear description

## Project Structure

- `apps/gateway` — Fastify API server (OpenAI-compatible)
- `apps/dashboard` — Next.js dashboard with server actions
- `apps/vscode-ext` — VSCode extension with chat and completion
- `apps/jetbrains-plugin` — IntelliJ IDEA / JetBrains plugin
- `packages/shared` — Shared types and constants
- `packages/router` — Routing engine + health monitor
- `packages/db` — Prisma schema, client, and seed
- `packages/sdk` — TypeScript SDK for consumers
- `packages/cli` — CLI tool (`mm chat`, `mm models`)
- `packages/config` — Shared tsconfig, eslint presets
- `plugins/` — Provider and integration plugins

## Adding a Provider

1. Create adapter in `apps/gateway/src/providers/{name}.ts`
2. Implement `ProviderAdapter` interface
3. Register in `apps/gateway/src/providers/factory.ts`
4. Add tests
5. Update documentation

## Code Style

- TypeScript strict mode enabled
- Prefer `const` and `let` over `var`
- Use `async/await` over raw promises
- Name files in `kebab-case.ts`
- Export interfaces from `index.ts`

## Questions?

- Open a GitHub Discussion for questions
- Join our Discord for real-time chat
- Check existing issues before filing new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
