# Dashboard Chat

The Dashboard Chat is a built-in testing interface for ModelMesh models. It lets you send messages to any configured provider and see streaming responses in real-time.

## Features

- **Model selector** — choose a specific model or let the router auto-select
- **Streaming responses** — SSE streaming with live token-by-token display
- **Markdown rendering** — code blocks, bold, italic, and inline code formatting
- **Conversation history** — persists chats in browser localStorage
- **System prompt editor** — customize the system prompt per conversation
- **Sidebar navigation** — create, switch, and delete conversations

## Usage

1. Open the dashboard at `http://localhost:3001/chat`
2. Select a model from the dropdown at the top:
   - **Auto (Router decides)** — the routing engine picks the best model
   - **Specific model** — routes directly to that model, skipping capability inference
3. Type a message and press **Enter** (Shift+Enter for new line)
4. Watch the response stream in real-time

## Architecture

The chat page communicates with the gateway through a Next.js API route proxy:

```
Dashboard (/chat) → /api/chat/completions → Gateway (/v1/chat/completions) → Provider
```

This ensures the dashboard works correctly in Docker environments where `localhost` inside the dashboard container refers to the container itself, not the host.

## Model Selection Behavior

When you explicitly select a model (e.g., `gpt-4`), the router skips capability inference and routes directly to that model. This ensures your chosen model is used even if its database capabilities don't perfectly match the inferred task type.

When **Auto** is selected, the router scores all candidates based on:
- Required capabilities (inferred from the request)
- Cost, latency, health, and routing rules
- Local-first preference (if enabled)

## Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| Failed to fetch | Gateway URL misconfiguration | Check `GATEWAY_URL` env var in dashboard container |
| 500 Internal Server Error | Model not found or provider error | Check gateway logs; verify model externalId exists at provider |
| Model mismatch | Router disqualified model | Ensure model capabilities include `chat` or select model explicitly |
