# ModelMesh OpenClaw Plugin

Official OpenClaw plugin for [ModelMesh](https://github.com/Mohamed1Fouad/ModelMesh). Register ModelMesh as a model provider in OpenClaw and route every request to the best model automatically.

## Features

- **Provider Registration** — ModelMesh appears as a first-class provider in OpenClaw (`modelmesh/auto`)
- **Model Listing** — Dynamically lists all models registered in your ModelMesh gateway
- **Auth Integration** — Uses OpenClaw's auth profiles or explicit API keys
- **Streaming Support** — Full SSE streaming pass-through
- **Health Checks** — Built-in `/modelmesh` and `/modelmesh-doctor` commands

## Installation

### Via OpenClaw Plugin Manager

```bash
openclaw plugins install @modelmesh/openclaw-plugin
```

### Manual Installation

```bash
git clone https://github.com/Mohamed1Fouad/ModelMesh.git
cd ModelMesh/plugins/openclaw
openclaw plugins install --link .
```

## Configuration

Add to your `~/.openclaw/openclaw.json`:

```json5
{
  plugins: {
    entries: {
      modelmesh: {
        enabled: true,
        config: {
          baseUrl: "http://localhost:3000",
          apiKey: "your-modelmesh-api-key",
          defaultModel: "auto",
          timeoutMs: 120000
        }
      }
    }
  },
  models: {
    defaults: {
      agent: {
        model: "modelmesh/auto"
      }
    }
  }
}
```

### Auth Profiles (Recommended)

Store your API key in OpenClaw's auth profiles:

```bash
openclaw auth add modelmesh --type api_key --key mm-sk-xxxxxxxx
```

Then omit `apiKey` from the plugin config.

## Commands

| Command | Description |
|---------|-------------|
| `/modelmesh` | Show gateway URL and available models |
| `/modelmesh-doctor` | Run health check on the ModelMesh gateway |

## Model Format

ModelMesh exposes models in the format `modelmesh/<modelId>`. Use `modelmesh/auto` to let ModelMesh's routing engine select the best model.

Examples:
- `modelmesh/auto` — Auto-route based on task type, cost, latency
- `modelmesh/gpt-4o` — Specific model
- `modelmesh/claude-sonnet-4` — Specific model

## Architecture

```
OpenClaw Agent
      │
      ▼
modelmesh/auto
      │
      ▼
ModelMesh Gateway (port 3000)
      │
      ├─→ RouterEngine scores providers
      ├─→ HealthMonitor checks status
      └─→ Provider Adapter calls LLM
```

## License

MIT — same as ModelMesh.
