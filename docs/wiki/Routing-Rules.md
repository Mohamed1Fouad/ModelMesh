# Routing Rules

Routing rules let you customize how ModelMesh selects providers for incoming requests. Rules are evaluated in priority order, and the first matching rule applies its action.

## Rule Structure

Each rule has:
- **Name** — human-readable identifier
- **Priority** — higher numbers evaluated first
- **Condition** — when the rule should match
- **Action** — what to do when the condition matches

## Conditions

| Type | Fields | Description |
|---|---|---|
| `task_type` | `taskType` | Match based on inferred task (chat, coding, reasoning, etc.) |
| `model_capability` | `capability` | Require a specific capability (vision, tool_use, etc.) |
| `max_price` | `pricePer1k` | Only apply if model price is below threshold |
| `max_latency` | `latencyMs` | Only apply if model latency is below threshold |
| `privacy_required` | `required` | Match when privacy flag is set |
| `provider` | `provider` | Match specific provider name |
| `context_size` | `maxTokens` | Match when required context fits |

## Actions

| Type | Fields | Description |
|---|---|---|
| `route_to` | `provider`, `model` (optional) | Force routing to a specific provider/model |
| `prefer_local` | — | Boost score for local providers |
| `score_boost` | `provider`, `boost` | Add points to a provider's score |
| `reject` | `reason` | Disqualify all candidates (returns error) |

## Creating Rules

1. Go to **Routing** in the dashboard
2. Click **Add Rule**
3. Select condition type and fill in fields
4. Select action type and configure
5. Set priority (higher = evaluated first)
6. Submit

## Model Selection in Rules

When using the **Route To** action, the provider dropdown lists all available providers. The model dropdown dynamically filters to show only models belonging to the selected provider. Choose **Any model** to route to the provider without forcing a specific model.

## Examples

**Route coding tasks to Claude:**
- Condition: Task Type = `coding`
- Action: Route To = `anthropic`
- Priority: `100`

**Boost local providers for private data:**
- Condition: Privacy Required = `true`
- Action: Prefer Local
- Priority: `90`

**Reject expensive requests:**
- Condition: Max Price = `0.01`
- Action: Reject = "Too expensive"
- Priority: `50`

## Evaluation Order

Rules are sorted by priority descending. For each candidate provider, conditions are checked in order. If a condition matches, its action is applied immediately. Multiple rules can affect the same candidate.
