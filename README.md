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
- **Dashboard chat** — built-in chat UI for testing models and streaming responses
- **Monthly quotas** — set cost limits on providers and models with usage visualization
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
   - Pick a model from the **Auto-fill from Catalog** dropdown — this pre-fills the correct native `externalId`, prices, and capabilities
   - Or enter manually:
     - **External ID**: `qwen3.5:0.8b` (or your pulled model name)
     - **Name**: `Qwen 3.5`
     - **Context Window**: `128000`
     - **Supports Streaming**: `true`

> **Note**: Prices are displayed as **Input/Output $/1M tokens** in the UI but stored per 1K tokens in the database. The catalog contains verified definitions for OpenAI, Anthropic, Ollama, and OpenRouter models (as of May 2026).

### 5. Test via Dashboard Chat

1. Open the dashboard: http://localhost:3001
2. Go to **Chat** in the navigation
3. Select a model from the dropdown (or choose **Auto** to let the router decide)
4. Type a message and press Enter to send
5. The response streams in real-time with markdown formatting

### 6. Test the API

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

## CLI Reference

ModelMesh ships with a CLI (`mm`) for managing everything from the terminal — no dashboard required.

### Installation

```bash
# From the repo root after building
pnpm --filter @modelmesh/cli build

# Or use the built binary directly
node packages/cli/dist/cli.js --help
```

### Global Options

Most commands support:

| Option | Description | Default |
|--------|-------------|---------|
| `-u, --url <url>` | Gateway URL | `http://localhost:3000` |
| `-k, --key <key>` | API key | `MODELMESH_API_KEY` env |

### Commands

#### `chat` — Send a chat completion
```bash
mm chat "Hello world" -m auto
mm chat "Explain quantum computing" -m openai/gpt-4o --stream
mm chat "Generate JSON" -m auto --json --system "You are a helpful assistant"
mm chat "Hello" --temperature 0.5 --max-tokens 100
```

#### `models` — List publicly available models
```bash
mm models
```

#### `provider` — Manage providers
```bash
mm provider list
mm provider get --id <provider-id>
mm provider add --name openai --display-name "OpenAI" --api-key sk-... --quota 10
mm provider update --id <provider-id> --display-name "Updated" --enabled true
mm provider delete --id <provider-id>
```

#### `model` — Manage models
```bash
mm model list
mm model get --id <model-id>
mm model add --provider-id <id> --external-id gpt-4o --name "GPT-4o" --prompt-price 0.0025 --completion-price 0.01
mm model update --id <model-id> --enabled false
mm model delete --id <model-id>
```

#### `rule` — Manage routing rules
```bash
mm rule list
mm rule get --id <rule-id>
mm rule add --name "Code to Claude" --condition '{"taskType":"coding"}' --action '{"routeTo":"anthropic"}' --priority 100
mm rule update --id <rule-id> --priority 200
mm rule toggle --id <rule-id> --enabled false
mm rule delete --id <rule-id>
```

#### `key` — Manage API keys
```bash
mm key list
mm key add --name "Production" --scopes "chat:write,models:read"
mm key revoke --id <key-id>
```

#### `team` — Manage teams
```bash
mm team list
mm team get --id <team-id>
mm team create --name "Engineering" --slug "eng" --description "Dev team"
mm team update --id <team-id> --name "Updated"
mm team delete --id <team-id>
mm team invite --id <team-id> --email "dev@example.com" --role developer
```

#### `marketplace` — Browse and install presets
```bash
mm marketplace list
mm marketplace get --id <preset-id>
mm marketplace install --id <preset-id>
```

#### `agent` — Manage agents
```bash
mm agent list
mm agent get --id <agent-id>
mm agent run --id <agent-id> --input '{"messages":[{"role":"user","content":"Hello"}]}'
```

#### `workflow` — Manage workflows
```bash
mm workflow list
mm workflow get --id <workflow-id>
mm workflow run --id <workflow-id> --input '{"topic":"AI"}'
```

#### `audit` — View audit logs
```bash
mm audit --limit 50
mm audit --action post --resource provider
mm audit --user-id <user-id>
```

#### `catalog` — Browse model catalog
```bash
mm catalog list
mm catalog list --provider openai
```

#### `usage` — Show usage statistics
```bash
mm usage
```

#### `health` — Show provider health
```bash
mm health
```

#### `refresh` — Reload provider config from database
```bash
mm refresh
```

#### `config` — Show current CLI config
```bash
mm config
```

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System design and data flow
- [docs/API_SPEC.md](./docs/API_SPEC.md) — OpenAI-compatible API reference
- [docs/OPENAI_COMPATIBLE_SETUP.md](./docs/OPENAI_COMPATIBLE_SETUP.md) — IDE setup for VS Code, JetBrains, Cursor, Claude Code
- [docs/ROADMAP.md](./docs/ROADMAP.md) — Branding, monetization, and milestones
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — Docker, Kubernetes, and cloud deployment
- [docs/wiki/Chat.md](./docs/wiki/Chat.md) — Dashboard chat feature
- [docs/wiki/Routing-Rules.md](./docs/wiki/Routing-Rules.md) — Routing rules configuration
- [docs/wiki/API-Keys.md](./docs/wiki/API-Keys.md) — API key management and scopes
- [docs/wiki/Monthly-Quotas.md](./docs/wiki/Monthly-Quotas.md) — Cost quota setup and monitoring
- [docs/wiki/Router-Engine.md](./docs/wiki/Router-Engine.md) — Routing engine scoring details

## Contributing

We welcome contributions! See our [Contributing Guide](./CONTRIBUTING.md) for details.

## License

MIT — free for personal and commercial use.

## Acknowledgments

ModelMesh is inspired by OpenRouter, LangChain, Ollama, and OpenClaw. Built for developers who want control over their AI stack.
