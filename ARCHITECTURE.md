# ModelMesh Architecture

## Overview

ModelMesh is an open-source AI routing platform that provides a unified, OpenAI-compatible API gateway over multiple LLM providers. It intelligently routes requests based on cost, latency, capabilities, privacy requirements, and health status.

## Core Principles

- **Local-first**: Prefer local models (Ollama, LM Studio) when privacy or cost is a concern
- **Developer control**: Bring your own API keys — no middleman markup
- **Drop-in compatible**: OpenAI-compatible API that works with existing SDKs and tools
- **Extensible**: Plugin architecture for adding new providers
- **Observable**: Full request tracing, usage analytics, and health monitoring

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
│  (OpenAI SDK, Cursor, VSCode, Custom Apps, CLI)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GATEWAY API (Fastify)                            │
│  • OpenAI-compatible REST API                                              │
│  • Streaming (SSE) support                                                 │
│  • Authentication & rate limiting                                          │
│  • Request logging & metrics                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
┌──────────────────────────────┐         ┌──────────────────────────────┐
│      ROUTER ENGINE         │         │      PROVIDER MANAGER        │
│  • Rule-based routing        │         │  • Health checks             │
│  • Scoring & ranking         │         │  • Config loading            │
│  • Fallback & failover     │         │  • Adapter factory           │
│  • Budget awareness          │         │  • Key management            │
└──────────────────────────────┘         └──────────────────────────────┘
                    │                                   │
                    └─────────────────┬─────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROVIDER ADAPTERS                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────────┐ │
│  │  OpenAI  │ │ Anthropic│ │  Ollama  │ │  Gemini  │ │  (plugin-ready)     │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼

┌──────────────────────────────┐         ┌──────────────────────────────┐
│      POSTGRESQL              │         │         REDIS (optional)     │
│  • Providers & models        │         │  • Rate limit counters       │
│  • Routing rules             │         │  • Session / queue           │
│  • Usage logs & analytics    │         │  • Pub/sub for health        │
│  • Budgets & alerts          │         │  • Request caching (planned) │
│  • Agent memory & sessions   │         │                              │
└──────────────────────────────┘         └──────────────────────────────┘
```

## Monorepo Structure

```
modelmesh/
├── apps/
│   ├── gateway/          # Fastify API server (OpenAI-compatible)
│   ├── dashboard/        # Next.js web dashboard
│   ├── vscode-ext/       # VSCode extension
│   └── jetbrains-plugin/ # IntelliJ IDEA / JetBrains plugin
├── packages/
│   ├── shared/           # Types, interfaces, constants
│   ├── router/           # Routing engine + health monitor
│   ├── db/               # Prisma client & schema
│   ├── sdk/              # TypeScript SDK for consumers
│   ├── cli/              # CLI tool
│   └── config/           # Shared tsconfig, eslint presets
├── plugins/
│   └── providers/        # Provider adapter plugins
│       ├── openai/
│       ├── anthropic/
│       └── ollama/
├── docker/
│   ├── docker-compose.yml
│   ├── gateway.Dockerfile
│   └── dashboard.Dockerfile
└── ARCHITECTURE.md
```

## Gateway API

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health |
| GET | `/v1/models` | List available models |
| POST | `/v1/chat/completions` | Chat completions (streaming supported) |
| POST | `/v1/embeddings` | Embeddings |
| GET | `/v1/dashboard/health` | Provider health status |
| GET | `/v1/dashboard/stats` | Aggregated usage stats |
| GET/POST/PUT/DELETE | `/v1/teams/*` | Team workspaces and membership |
| GET/POST | `/v1/marketplace/*` | Model marketplace browse and install |
| GET | `/v1/audit-logs` | Enterprise audit log query |
| GET/POST | `/v1/agents/*` | Agent management and execution |
| GET/POST | `/v1/workflows/*` | Workflow management and execution |
| GET | `/v1/tools/*` | Tool definitions and testing |

### Request Routing Flow

1. Client sends OpenAI-compatible request to `/v1/chat/completions`
2. Gateway parses request and infers task type and required capabilities
3. `RouterEngine` evaluates all candidate providers against:
   - Required capabilities
   - Context window limits
   - Privacy constraints (local-only)
   - Price ceiling
   - Latency ceiling
   - Active routing rules
   - Provider health status
   - Local-first preference
   - Budget constraints
4. Providers are scored; highest score wins
5. Provider adapter normalizes request to provider-specific format
6. Response is streamed back in OpenAI-compatible SSE format
7. Usage is logged to PostgreSQL for analytics
8. If provider fails and fallback is enabled, next best candidate is tried

## Router Engine

### Scoring Algorithm

The router uses a composite scoring function:

```
score = capabilityMatchScore + costScore + latencyScore + healthBoost + ruleBoost + weightBoost + localFirstBoost
```

- **Capability match**: +5 per matched capability (weighted by importance)
- **Cost score**: max(0, 20 - cost * 1000)
- **Latency score**: max(0, 15 - ttft_ms / 200)
- **Health boost**: +10 healthy, -20 degraded, -100 unhealthy
- **Rule boost**: configured via routing rules (can force, reject, or boost)
- **Weight boost**: provider weight * 2
- **Local-first boost**: +25 if local provider and localFirst enabled

### Routing Rules

Rules are evaluated in priority order (highest first). Each rule has:
- **Condition**: task_type, model_capability, max_price, max_latency, privacy_required, provider, context_size
- **Action**: route_to, prefer_local, score_boost, fallback, reject

### Health Monitoring

The `HealthMonitor` polls providers on a configurable interval:
- Healthy if response OK and latency below threshold
- Degraded if latency exceeds threshold or intermittent failures
- Unhealthy after consecutive failures exceed threshold
- Status changes trigger callbacks for alerting

## Provider Abstraction

Each provider implements `ProviderAdapter`:

```typescript
interface ProviderAdapter {
  chatCompletion(body, config, targetModel): Promise<ChatCompletionResponse>;
  chatCompletionStream(body, config, targetModel): Promise<AsyncIterable>;
}
```

Adapters translate OpenAI-shaped requests to provider-native formats and responses back to OpenAI format. This ensures the gateway remains a drop-in replacement.

Current adapters: **OpenAI**, **Anthropic**, **Ollama**

### Adding a New Provider

1. Create adapter in `apps/gateway/src/providers/{name}.ts`
2. Implement `chatCompletion` and `chatCompletionStream`
3. Register in `factory.ts`
4. Add provider + models to database via dashboard or seed
5. Optionally add routing rules for task-type mapping

## Database Schema

### Key Entities

- **Provider**: Provider configurations (base URL, API key, timeout, weight)
- **Model**: Model metadata (capabilities, context window, pricing, latency profile)
- **RoutingRule**: Rule definitions stored as JSON
- **UsageLog**: Per-request telemetry (tokens, cost, latency, routing decision)
- **HealthLog**: Provider health check history
- **Budget**: Spend tracking with alert thresholds
- **ApiKey**: Gateway API keys for client authentication
- **User**: Dashboard users with role (super_admin, admin, user)
- **UserSession**: Bearer token sessions for user authentication
- **Team**: Workspace with slug, description, and enabled flag
- **TeamMember**: Membership linking users to teams with role
- **TeamInvitation**: Token-based email invitations
- **TeamProvider**: Team-scoped provider overrides
- **AuditLog**: Immutable record of every mutating request
- **MarketplacePreset**: Pre-configured model templates for one-click install
- **Agent**: Agent definitions with system prompts and tools
- **Workflow**: Multi-agent workflow definitions
- **AgentSession**: Conversation sessions for agents
- **AgentMemory**: RAG memory store for agents
- **Setting**: Key-value system configuration

## Streaming Architecture

All streaming uses Server-Sent Events (SSE) with the OpenAI chunk format. The `streamTransformer` normalizes provider-specific streaming protocols:

- **OpenAI**: SSE with `data:` JSON chunks
- **Anthropic**: SSE with `message_start`, `content_block_delta`, `message_stop`
- **Ollama**: NDJSON stream

Each chunk is transformed to `StreamingChunk` before being sent to the client.

## Security Model

- **API keys** are stored hashed with prefix for identification
- **Provider keys** are stored encrypted at rest (field-level)
- **RBAC** with four roles: owner, admin, developer, viewer — each with granular permissions
- **Team multi-tenancy** with scoped providers, budgets, and memberships
- **Audit logging** automatically records every mutating request with IP and user agent
- **Session auth** via bearer tokens for dashboard users
- No vendor lock-in: all routing logic and keys are yours
- Privacy-first: local providers never send data externally
- Optional telemetry: disabled by default, opt-in only
- CORS configurable per deployment

## Enterprise Features (Phase 5)

### Team Workspaces

Teams enable multi-tenancy within a single self-hosted instance:
- Each team has its own slug, members, provider overrides, and budgets
- Members have roles (owner, admin, developer, viewer)
- Team provider overrides allow custom base URLs and API keys per team
- Invitations are token-based and expire after 7 days

### RBAC

Permissions are checked via `requirePermission(permission)` middleware:
- `owner`: full access (`*`)
- `admin`: provider/rule/key/agent/workflow/team/marketplace management
- `developer`: read access + key/agent/workflow write
- `viewer`: read-only access
- `super_admin`: system-wide bypass

### Audit Logs

Every mutating request (POST/PUT/DELETE/PATCH) is automatically logged:
- Action, resource, resource ID, user, team, IP, user agent
- Queryable by action, resource, user, team
- Summary statistics by action and resource type

### Marketplace

Self-hosted model marketplace for one-click local deployment:
- Presets include provider name, model ID, capabilities, pricing, and tags
- Install creates a local Provider + Model record automatically
- Categories: general, coding, reasoning, vision, local
- Fully extensible — add your own presets via dashboard or API

## OpenClaw Integration (Phase 4)

OpenClaw agents integrate as a routing target:

1. Agent definitions stored as models with `agent_orchestration` capability
2. Agent tool execution runs through the gateway as function calls
3. Multi-agent workflows are orchestrated via routing rules that chain agents
4. Memory support via PostgreSQL (with optional Redis caching)
5. Agents can invoke other agents through the same gateway API

## Performance Considerations

- Provider configs and rules are cached in memory, refreshed every 60s
- Health checks run asynchronously and do not block requests
- Streaming uses backpressure-aware readers
- Database writes for usage logging are fire-and-forget (best effort)
- Redis planned for distributed rate limiting and request deduplication (not yet active)

## Deployment

### Docker Compose (local)

```bash
docker compose -f docker/docker-compose.yml up -d
```

### Self-hosted

1. Install PostgreSQL + Redis
2. Set environment variables (see `.env.example`)
3. Run `pnpm install && pnpm db:migrate && pnpm build`
4. Start gateway: `pnpm gateway:dev`
5. Start dashboard: `pnpm dashboard:dev`

### Production

- Run gateway behind a reverse proxy (nginx, traefik, caddy)
- Enable HTTPS termination at proxy
- Use connection pooling for PostgreSQL
- Redis for distributed rate limiting across gateway replicas
- Gateway is horizontally scalable (stateless)
