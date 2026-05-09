# ModelMesh API Specification

## Base URL

```
http://localhost:3000/v1
```

## Authentication

Two methods are supported:

### API Key

```
X-API-Key: {api_key}
```

### Bearer Token (User Session)

```
Authorization: Bearer {session_token}
```

### Local Development

Set `ALLOW_UNAUTHENTICATED=true` to allow anonymous access. User will be assigned role `user`.

## Core Endpoints

### List Models

```
GET /models
```

**Response**

```json
{
  "object": "list",
  "data": [
    {
      "id": "openai/gpt-4o",
      "object": "model",
      "created": 1710000000,
      "owned_by": "OpenAI"
    }
  ]
}
```

### Chat Completions

```
POST /chat/completions
```

**Headers**

```
Content-Type: application/json
```

**Body**

```json
{
  "model": "auto",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "What is the capital of France?" }
  ],
  "stream": false,
  "temperature": 0.7,
  "max_tokens": 1024,
  "tools": [],
  "privacy": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| model | string | No | Model ID or `"auto"` for automatic routing |
| messages | array | Yes | Array of chat messages |
| stream | boolean | No | Enable SSE streaming |
| temperature | number | No | Sampling temperature (0-2) |
| max_tokens | integer | No | Maximum tokens to generate |
| top_p | number | No | Nucleus sampling |
| tools | array | No | Tool definitions for function calling |
| tool_choice | string/object | No | Tool selection strategy |
| response_format | object | No | `{ "type": "json_object" }` |
| privacy | boolean | No | Require local/privacy-preserving provider |
| stop | string/array | No | Stop sequences |
| user | string | No | End-user identifier |

**Non-Standard Fields**

| Field | Type | Description |
|-------|------|-------------|
| privacy | boolean | Forces routing to local providers only |

**Response (Non-Streaming)**

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1710000000,
  "model": "anthropic/claude-3-5-sonnet-20241022",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The capital of France is Paris."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 10,
    "total_tokens": 35
  }
}
```

**Response (Streaming)**

SSE stream of chunks:

```
data: {"id":"...","object":"chat.completion.chunk","created":...,"model":"...","choices":[{"index":0,"delta":{"role":"assistant","content":"The"},"finish_reason":null}]}

data: {"id":"...","object":"chat.completion.chunk",...,"choices":[{"index":0,"delta":{"content":" capital"},"finish_reason":null}]}

data: [DONE]
```

### Embeddings

```
POST /embeddings
```

**Body**

```json
{
  "model": "text-embedding-3-small",
  "input": "The quick brown fox"
}
```

> Note: Currently returns 501 — not yet implemented.

### Health

```
GET /health
```

**Response**

```json
{
  "status": "ok",
  "uptime": 1234.56
}
```

### Dashboard Health

```
GET /dashboard/health
```

Requires `usage:read` permission.

**Response**

```json
{
  "health": [
    {
      "provider": "openai",
      "status": "healthy",
      "lastChecked": "2024-01-15T10:00:00.000Z",
      "latencyMs": 450,
      "errorRate": 0,
      "successRate": 1,
      "consecutiveFailures": 0
    }
  ]
}
```

### Dashboard Stats

```
GET /dashboard/stats
```

Requires `usage:read` permission.

**Response**

```json
{
  "totalRequests": 15420,
  "totalCost": 4.8321,
  "averageLatencyMs": 520
}
```

## Agent Endpoints

All agent endpoints require authentication and the appropriate permission (`agent:read` or `agent:write`).

### List Agents

```
GET /agents
```

### Get Agent

```
GET /agents/:id
```

### Execute Agent

```
POST /agents/:id/execute
```

**Body**

```json
{
  "messages": [{ "role": "user", "content": "Hello" }],
  "sessionId": "optional-existing-session",
  "stream": false,
  "userId": "user-123",
  "context": { "topic": "quantum computing" }
}
```

### List Agent Sessions

```
GET /agents/:id/sessions
```

### Get Session Messages

```
GET /agents/sessions/:sessionId/messages
```

### Add Memory

```
POST /agents/:id/memory
```

**Body**

```json
{
  "type": "conversation",
  "content": "User prefers concise answers.",
  "sessionId": "optional",
  "metadata": { "importance": "high" }
}
```

### Query Memory

```
GET /agents/:id/memory?sessionId=&type=&limit=20
```

## Workflow Endpoints

Requires `workflow:read` or `workflow:write` permission.

### List Workflows

```
GET /workflows
```

### Get Workflow

```
GET /workflows/:id
```

### Execute Workflow

```
POST /workflows/:id/execute
```

**Body**

```json
{
  "topic": "quantum computing",
  "audience": "high school students"
}
```

### List Executions

```
GET /workflows/:id/executions
```

## Tool Endpoints

Requires `agent:read` or `agent:write` permission.

### List Tools

```
GET /tools
```

### Execute Tool (Debug)

```
POST /tools/:name/execute
```

> Note: Currently returns 501 — not yet implemented.

## Team Endpoints

Requires authentication. Uses `team:read` and `team:write` permissions.

### List My Teams

```
GET /teams
```

### Get Team

```
GET /teams/:id
```

### Create Team

```
POST /teams
```

**Body**

```json
{
  "name": "Engineering",
  "slug": "engineering",
  "description": "Engineering team workspace"
}
```

### Update Team

```
PUT /teams/:id
```

### Delete Team

```
DELETE /teams/:id
```

### Invite Member

```
POST /teams/:id/invitations
```

**Body**

```json
{
  "email": "dev@example.com",
  "role": "developer"
}
```

### List Invitations

```
GET /teams/:id/invitations
```

### Accept Invitation

```
POST /invitations/:token/accept
```

### Update Member Role

```
PUT /teams/:id/members/:memberId
```

**Body**

```json
{ "role": "admin" }
```

### Remove Member

```
DELETE /teams/:id/members/:memberId
```

### Update Team Provider Override

```
PUT /teams/:id/providers/:providerId
```

**Body**

```json
{
  "enabled": true,
  "customBaseUrl": "http://internal-llm:11434",
  "customApiKey": "sk-internal",
  "weight": 2
}
```

## Marketplace Endpoints

Requires `marketplace:read` or `marketplace:write` permission.

### List Presets

```
GET /marketplace?category=local&search=llama
```

### Get Preset

```
GET /marketplace/:id
```

### Install Preset

```
POST /marketplace/:id/install
```

Creates a local `Provider` and `Model` record from the preset.

### Create Preset (Admin)

```
POST /marketplace
```

### Delete Preset

```
DELETE /marketplace/:id
```

## Audit Log Endpoints

Requires `audit:read` permission.

### Query Audit Logs

```
GET /audit-logs?action=post&resource=provider&userId=&teamId=&limit=100&offset=0
```

**Response**

```json
{
  "data": [
    {
      "id": "...",
      "userId": "user-123",
      "teamId": "team-456",
      "action": "post",
      "resource": "provider",
      "resourceId": "provider-789",
      "details": { "body": { "name": "OpenAI" } },
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "timestamp": "2024-01-15T10:00:00.000Z"
    }
  ],
  "total": 15420
}
```

## Error Format

All errors follow the OpenAI error structure:

```json
{
  "error": {
    "message": "Provider unavailable",
    "type": "provider_error",
    "code": "routing_failed"
  }
}
```

### Error Types

| Type | HTTP | Description |
|------|------|-------------|
| `authentication_error` | 401 | Missing or invalid API key/session |
| `authorization_error` | 403 | Insufficient permissions for action |
| `invalid_request_error` | 400 | Malformed request or missing fields |
| `not_found` | 404 | Resource does not exist |
| `conflict` | 409 | Resource already exists |
| `provider_error` | 502 | Provider returned an error |
| `server_error` | 500 | Internal gateway error |
| `not_implemented` | 501 | Feature not yet available |
| `agent_error` | 500 | Agent execution failed |
| `workflow_error` | 500 | Workflow execution failed |

## Rate Limiting

Rate limits are enforced per API key when configured. Future versions will return headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1710000000
```

## SDK Usage

### TypeScript SDK

```typescript
import { ModelMeshClient } from "@modelmesh/sdk";

const client = new ModelMeshClient({
  baseUrl: "http://localhost:3000",
  apiKey: "mm-key-123",
});

// Non-streaming
const response = await client.chatCompletion({
  messages: [{ role: "user", content: "Hello" }],
});

// Streaming
for await (const chunk of client.chatCompletionStream({ messages: [...] })) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}

// List models
const models = await client.listModels();
```

### OpenAI SDK

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: "any",
  baseURL: "http://localhost:3000/v1",
});

const completion = await openai.chat.completions.create({
  model: "auto",
  messages: [{ role: "user", content: "Hello" }],
});
```
