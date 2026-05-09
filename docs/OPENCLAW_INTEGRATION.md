# OpenClaw Agent & Workflow Integration

## Overview

ModelMesh includes a built-in agent and workflow engine inspired by OpenClaw. Agents are first-class citizens in the routing layer — they can be invoked directly, participate in workflows, use tools, and persist memory across sessions.

## Architecture

```
┌─────────────────────────────────────────────┐
│              CLIENT REQUEST                 │
│   "Research this topic and write a blog"   │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│           MODELMESH GATEWAY                │
│  • Task type inferred: agent_orchestration │
│  • Route to agent or workflow              │
└─────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│   AGENT      │        │  WORKFLOW    │
│  ENGINE      │        │  ENGINE      │
│              │        │              │
│ • System     │        │ • Step exec  │
│   prompt     │        │ • Input map  │
│ • Tool loop  │        │ • Output map │
│ • Session    │        │ • State mgmt │
│   persist    │        │              │
└──────────────┘        └──────────────┘
        │                       │
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│  TOOL REG    │        │   MEMORY     │
│  web_search  │        │   SERVICE    │
│  read_file   │        │              │
│  http_req    │        │ • Facts      │
│  math_eval   │        │ • Preferences│
│  datetime    │        │ • RAG sim    │
└──────────────┘        └──────────────┘
```

## Agent Engine

The `AgentEngine` runs agents through the standard provider adapters:

1. Loads the agent definition from PostgreSQL
2. Gets or creates an `AgentSession`
3. Injects the agent's `systemPrompt` as the first message
4. Sends the conversation to the LLM via the router (respects provider/model overrides)
5. If the model requests a tool call:
   - Executes the tool via the `ToolRegistry`
   - Appends the tool result to the conversation
   - Re-sends to the LLM (up to `maxIterations`)
6. Persists all messages to `AgentMessage` records
7. Stores memories via the `MemoryService`

## Agents as Database Records

Agents are stored in the `Agent` table and linked to a provider + model:

```prisma
model Agent {
  id           String   @id @default(cuid())
  name         String
  description  String?
  systemPrompt String   @default("")
  providerId   String?
  modelId      String?
  tools        String[]
  capabilities String[]
  memoryEnabled Boolean @default(true)
  maxIterations Int      @default(5)
  enabled      Boolean  @default(true)
}
```

This means agents are routed like any other model — the gateway picks the provider based on cost, latency, health, and rules.

## Tool Registry

Built-in tools are registered at startup:

| Tool | Handler | Description |
|------|---------|-------------|
| `web_search` | `builtin:web_search` | Search the web |
| `http_request` | `builtin:http_request` | HTTP GET/POST/PUT/DELETE |
| `read_file` | `builtin:read_file` | Read file contents |
| `write_file` | `builtin:write_file` | Write file contents |
| `math_evaluate` | `builtin:math_evaluate` | Evaluate math expression |
| `date_time` | `builtin:date_time` | Get current date/time |

Tool definitions are stored in `ToolDefinition` and validated against JSON Schema parameters.

## Multi-Agent Workflows

Workflows chain multiple agents with declarative input/output mapping:

```prisma
model Workflow {
  id          String   @id @default(cuid())
  name        String
  description String?
  enabled     Boolean  @default(true)
  steps       WorkflowStep[]
}

model WorkflowStep {
  id            String
  workflowId    String
  agentId       String
  name          String
  inputMapping  Json     // { "param": "state.path" }
  outputMapping Json     // { "_content": "result_key" }
  order         Int
}
```

### Execution Flow

1. Load workflow steps ordered by `order`
2. Initialize shared state with the incoming request body
3. For each step:
   - Map inputs from state using dot-notation paths (e.g. `research_notes`)
   - Execute the step's agent via `AgentEngine`
   - Map outputs back to state using `outputMapping`
4. Persist `WorkflowExecution` and `WorkflowStepResult` records
5. Return final state

### Example Workflow

The seeded "Research & Write" workflow:

| Step | Agent | Input Mapping | Output Mapping |
|------|-------|---------------|----------------|
| 1 | Researcher | `{ topic: "topic" }` | `{ _content: "research_notes" }` |
| 2 | Writer | `{ research: "research_notes", topic: "topic" }` | `{ _content: "blog_post" }` |

## Memory & RAG

Agent memory is stored in `AgentMemory` with three types:

- `conversation` — transcript snippets from sessions
- `fact` — extracted facts about the user or domain
- `preference` — user preferences and style guides

### RAG Search

Memory retrieval uses cosine similarity over JSON-stored embeddings (no pgvector required):

```typescript
// Pseudocode for similarity search
const memories = await prisma.agentMemory.findMany({ where: { agentId, type } });
const ranked = memories
  .map(m => ({ ...m, similarity: cosineSimilarity(queryEmbedding, m.embedding) }))
  .sort((a, b) => b.similarity - a.similarity)
  .slice(0, limit);
```

Embeddings are stored as JSON arrays in the `embedding` field. For production scale, replace with `pgvector` or an external vector DB.

## Sessions

Each agent conversation is tracked as an `AgentSession`:

```prisma
model AgentSession {
  id       String   @id @default(cuid())
  agentId  String
  userId   String?
  title    String?
  status   String   @default("active")
  messages AgentMessage[]
  memories AgentMemory[]
}
```

Messages follow the OpenAI message shape:

```prisma
model AgentMessage {
  id        String   @id @default(cuid())
  sessionId String
  role      String   // system, user, assistant, tool
  content   String
  toolCalls Json?    // Array of { name, arguments, id }
  toolCallId String? // Response to a specific tool call
  metadata  Json?
}
```

## API Endpoints

See [API_SPEC.md](./API_SPEC.md) for full endpoint details.

Key routes:
- `GET /v1/agents` — List agents
- `POST /v1/agents/:id/execute` — Run an agent
- `GET /v1/agents/:id/sessions` — List sessions
- `GET /v1/agents/sessions/:sessionId/messages` — Session history
- `POST /v1/agents/:id/memory` — Add memory
- `GET /v1/agents/:id/memory` — Query memories
- `GET /v1/workflows` — List workflows
- `POST /v1/workflows/:id/execute` — Run a workflow
- `GET /v1/workflows/:id/executions` — Execution history
- `GET /v1/tools` — List available tools

All endpoints require authentication and the relevant RBAC permission (`agent:read`, `agent:write`, `workflow:read`, `workflow:write`).

## Implementation Status

### Phase 4A — Agent Engine ✅
- [x] Agent execution via provider adapters
- [x] Agent registration in Prisma schema
- [x] Basic tool execution registry
- [x] Session management

### Phase 4B — Workflows ✅
- [x] Workflow definition schema
- [x] Step-by-step execution engine
- [x] Input/output state mapping with dot-notation
- [x] Execution persistence

### Phase 4C — Memory ✅
- [x] Conversation memory persistence
- [x] Session management
- [x] RAG similarity search (JSON embeddings)

### Phase 4D — Advanced Orchestration
- [ ] Parallel agent execution within workflows
- [ ] Result aggregation strategies (map-reduce, voting)
- [ ] Conditional workflow branching
- [ ] Human-in-the-loop approval steps
