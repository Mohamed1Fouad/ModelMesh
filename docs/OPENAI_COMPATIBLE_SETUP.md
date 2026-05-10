# OpenAI-Compatible Setup Guide

ModelMesh exposes a fully OpenAI-compatible REST API at `/v1/chat/completions` and `/v1/models`. This means any tool, IDE, or library that works with OpenAI can point at ModelMesh instead.

## Base URL

```
http://localhost:3000/v1
```

If you are running ModelMesh on a remote server, replace `localhost:3000` with your server's address.

## API Key

1. Open the ModelMesh dashboard at `http://localhost:3001`
2. Go to **API Keys** → **Create Key**
3. Copy the generated key

For local development without auth, set `ALLOW_UNAUTHENTICATED=true` in your `.env` and leave the API key empty.

---

## VS Code

### Option A: ModelMesh Extension (Recommended)

1. Download the latest `.vsix` from the [GitHub Actions artifacts](https://github.com/Mohamed1Fouad/ModelMesh/actions)
2. In VS Code, press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Run **Extensions: Install from VSIX**
4. Select the downloaded `.vsix` file
5. Open the ModelMesh panel from the sidebar or press `Cmd+Shift+M` / `Ctrl+Shift+M`
6. Set your gateway URL in VS Code settings: `modelmesh.baseUrl`

### Option B: Continue.dev Extension

1. Install the [Continue.dev](https://continue.dev) extension
2. Open `~/.continue/config.json`
3. Add a ModelMesh provider block:

```json
{
  "models": [
    {
      "title": "ModelMesh",
      "provider": "openai",
      "model": "auto",
      "apiBase": "http://localhost:3000/v1",
      "apiKey": "your-modelmesh-key"
    }
  ]
}
```

---

## OpenClaw

ModelMesh has a native OpenClaw plugin that registers it as a first-class provider.

### Installation

```bash
openclaw plugins install @modelmesh/openclaw-plugin
```

Or manually from the repo:

```bash
cd ModelMesh/plugins/openclaw
openclaw plugins install --link .
```

### Configuration

Add to `~/.openclaw/openclaw.json`:

```json5
{
  plugins: {
    entries: {
      modelmesh: {
        enabled: true,
        config: {
          baseUrl: "http://localhost:3000",
          apiKey: "your-modelmesh-key"
        }
      }
    }
  },
  models: {
    defaults: {
      agent: { model: "modelmesh/auto" }
    }
  }
}
```

### Usage

- Use `modelmesh/auto` as your agent model — ModelMesh routes to the best provider
- Run `/modelmesh` in chat to see available models
- Run `/modelmesh-doctor` to health-check the gateway

---

## JetBrains IDEs (IntelliJ, PyCharm, WebStorm, etc.)

1. Download the latest plugin ZIP from the [GitHub Actions artifacts](https://github.com/Mohamed1Fouad/ModelMesh/actions)
2. Open your IDE → **Settings** → **Plugins** → **Install Plugin from Disk...**
3. Select the downloaded ZIP file and restart the IDE
4. Open **Settings** → **Tools** → **ModelMesh**
5. Set:
   - **Gateway URL**: `http://localhost:3000`
   - **API Key**: your ModelMesh API key (leave empty if unauthenticated)
6. Use the **ModelMesh Chat** tool window or press `Ctrl+Shift+M` to open chat

---

## Cursor

1. Open Cursor → **Settings** → **General**
2. Under **OpenAI API Key**, click **Override OpenAI Base URL**
3. Set:
   - **Base URL**: `http://localhost:3000/v1`
   - **API Key**: your ModelMesh API key
4. In the model dropdown, select any model name — ModelMesh will auto-route

---

## Claude Code

Claude Code uses its own API by default, but you can point it at ModelMesh via environment variables:

```bash
export CLAUDE_CODE_USE_VERTEX=false
export OPENAI_API_KEY="your-modelmesh-key"
export OPENAI_BASE_URL="http://localhost:3000/v1"
claude
```

> Note: Claude Code's OpenAI compatibility is experimental. Full support may vary by version.

---

## Generic OpenAI SDK (Python)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="your-modelmesh-key",  # optional if unauthenticated
)

response = client.chat.completions.create(
    model="auto",  # or specify a model ID
    messages=[{"role": "user", "content": "Hello world"}],
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

---

## Generic OpenAI SDK (Node.js)

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: "your-modelmesh-key", // optional if unauthenticated
});

const stream = await openai.chat.completions.create({
  model: "auto",
  messages: [{ role: "user", content: "Hello world" }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}
```

---

## cURL

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-modelmesh-key" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Hello world"}],
    "stream": false
  }'
```

---

## Listing Available Models

```bash
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer your-modelmesh-key"
```

Returns all models registered in ModelMesh, including their capabilities and pricing.
