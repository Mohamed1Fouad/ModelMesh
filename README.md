# ModelMesh

> **Stop overpaying for AI. Route every request to the right model automatically using your own API keys. No middleman. No markup.**

ModelMesh is an open-source AI routing platform — like OpenRouter + LangChain + Ollama, but fully open source, local-first, developer-first, and self-hostable.

## Features

- **OpenAI-compatible API** — drop-in replacement for any app using OpenAI SDKs
- **Multi-provider routing** — OpenAI, Anthropic, Ollama, and extensible to Gemini, Groq, DeepSeek, Mistral, and more
- **Smart routing engine** — route by price, latency, capabilities, privacy, and task type
- **Local-first** — prefer local Ollama/LM Studio models for cheap, private tasks
- **Automatic failover** — fallback to the next best provider if one fails
- **Streaming support** — real-time SSE streaming for all providers
- **Cost optimization** — budget-aware routing with per-request cost estimation
- **Premium dashboard** — Next.js dashboard with analytics, health monitoring, and provider management
- **VSCode extension** — inline chat, model switching, code completion, code explanation
- **JetBrains plugin** — IntelliJ IDEA plugin with chat panel, model switching, and explain code
- **OpenClaw plugin** — native OpenClaw provider integration with model listing and streaming
- **Self-hosted** — Docker Compose setup, bring your own keys

## Quick Start

### Prerequisites

- Docker Desktop (macOS/Windows/Linux)
- Git

### 1. Clone and configure

```bash
git clone https://github.com/Mohamed1Fouad/ModelMesh.git
cd ModelMesh
cp .env.example .env
```

Edit `.env` with your provider API keys:
```bash
# Required for external providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# For local Ollama (macOS/Windows Docker Desktop)
OLLAMA_BASE_URL=http://host.docker.internal:11434

# For Ollama on Linux, use your host IP instead:
# OLLAMA_BASE_URL=http://192.168.1.42:11434
```

### 2. Start with Docker Compose

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

This starts:
- **PostgreSQL** (port 5432) — database
- **Redis** (port 6379) — caching
- **Migrate** — auto-runs Prisma migrations on startup
- **Gateway** (port 3000) — OpenAI-compatible API
- **Dashboard** (port 3001) — web UI

### 3. Create an API key

1. Open the dashboard: http://localhost:3001
2. Go to **API Keys** → **Create Key**
3. Copy the key (starts with `mm-sk-...`)

### 4. Add a provider

1. In the dashboard, go to **Providers** → **Add Provider**
2. Fill in:
   - **Name**: `ollama` (lowercase)
   - **Display Name**: `Ollama`
   - **Base URL**: `http://host.docker.internal:11434`
   - **API Key**: (leave empty for local Ollama)
3. Add a model:
   - **External ID**: `qwen3.5:0.8b` (or your pulled model name)
   - **Name**: `Qwen 3.5`
   - **Context Window**: `128000`
   - **Supports Streaming**: `true`

> **Note**: Model capabilities default to all 12 types (chat, streaming, tool_use, vision, etc.) so the router never disqualifies the model.

### 5. Test the API

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer mm-sk-YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'
```

Or use the OpenAI SDK:

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: "mm-sk-YOUR_KEY",
});

const response = await openai.chat.completions.create({
  model: "auto",
  messages: [{ role: "user", content: "Hello world" }],
});
```

### OpenClaw Setup

1. Install the ModelMesh plugin in OpenClaw
2. Add your API key to `~/.openclaw/openclaw.json`:

```json
{
  "models": {
    "providers": {
      "modelmesh": {
        "baseUrl": "http://localhost:3000/v1",
        "api": "openai-completions",
        "apiKey": "mm-sk-YOUR_KEY",
        "models": [
          {
            "id": "auto",
            "name": "Auto-route",
            "contextWindow": 128000,
            "maxTokens": 8192
          }
        ]
      }
    }
  }
}
```

3. Use `modelmesh/auto` as your model in OpenClaw

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design.

## Project Roadmap

### Phase 1 — Gateway + Routing ✅
- [x] OpenAI-compatible API (`/v1/chat/completions`, `/v1/models`)
- [x] Provider abstraction layer with adapter pattern
- [x] Routing engine with composite scoring (cost, latency, capabilities, health, rules)
- [x] Health monitoring with automatic failover
- [x] SSE streaming support with provider normalization
- [x] Usage logging and cost tracking

### Phase 2 — Dashboard + Analytics ✅
- [x] Provider management UI (CRUD, toggle, model tables)
- [x] Routing rules editor (visual condition/action builder)
- [x] Usage analytics with provider and task-type breakdowns
- [x] API key management (create, revoke, scopes, rate limits)
- [x] Real-time health status monitoring
- [x] Request history with cost and latency per request
- [x] Next.js App Router with server actions

### Phase 3 — IDE Plugins ✅
- [x] VSCode extension with chat panel and streaming
- [x] VSCode inline code completion (experimental, toggleable)
- [x] VSCode context menu actions (explain code, generate from comment)
- [x] VSCode model switching via command palette
- [x] JetBrains plugin scaffold with chat tool window
- [x] JetBrains settings configurable panel
- [x] JetBrains explain code and model switching actions

### Phase 4 — Agents ✅
- [x] Agent definitions and provider adapter
- [x] Agent execution with system prompts and session management
- [x] Tool execution registry (web_search, http_request, read/write file, math, datetime, gateway query)
- [x] Multi-agent workflow engine with step-by-step execution
- [x] Workflow input/output mapping between steps
- [x] Agent memory persistence (conversation, fact, preference)
- [x] Memory search with cosine similarity for RAG
- [x] Agent sessions with message history
- [x] Gateway API endpoints: `/v1/agents/*`, `/v1/workflows/*`, `/v1/tools/*`

### Phase 5 — Self-Hosted Enterprise ✅
- [x] RBAC with owner/admin/developer/viewer roles and granular permissions
- [x] Enterprise audit logs with action/resource filtering
- [ ] Hosted cloud version (planned for future — self-hosted only for now)

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
│   ├── db/               # Prisma schema + client + seed
│   ├── sdk/              # TypeScript SDK for consumers
│   ├── cli/              # CLI tool (`mm chat`, `mm models`)
│   └── config/           # Shared tsconfig, eslint presets
├── plugins/
│   └── openclaw/         # OpenClaw plugin
├── docker/               # Docker Compose + Dockerfiles
└── docs/                 # Architecture, API spec, deployment guides
```

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System design and data flow
- [docs/API_SPEC.md](./docs/API_SPEC.md) — OpenAI-compatible API reference
- [docs/OPENAI_COMPATIBLE_SETUP.md](./docs/OPENAI_COMPATIBLE_SETUP.md) — IDE setup for VS Code, JetBrains, Cursor, Claude Code
- [docs/ROADMAP.md](./docs/ROADMAP.md) — Branding, monetization, and milestones
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — Docker, Kubernetes, and cloud deployment

## Contributing

We welcome contributions! See our [Contributing Guide](./CONTRIBUTING.md) for details.

## License

MIT — free for personal and commercial use.

## Acknowledgments

ModelMesh is inspired by OpenRouter, LangChain, Ollama, and OpenClaw. Built for developers who want control over their AI stack.
