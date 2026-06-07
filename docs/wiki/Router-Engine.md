# Router Engine

The Router Engine is the core scoring system that selects the best provider for each request.

## Scoring Pipeline

For each request, the engine:

1. **Gathers candidates** — all enabled models from all providers
2. **Filters** — hard disqualification rules
3. **Scores** — soft ranking signals
4. **Ranks** — sorts by final score descending
5. **Returns** — winner + top 3 alternatives

## Hard Filters

Candidates are disqualified if they fail any filter:

| Filter | Condition |
|---|---|
| Capability | Model must support all `requiredCapabilities` |
| Context Window | Model context window must fit estimated tokens |
| Privacy | If `privacyRequired`, only local providers allowed |
| Price | Model price must be below `maxPricePer1k` |
| Latency | Model latency must be below `maxLatencyMs` |
| Explicit Model | If `model` is specified, must match exactly |

When an **explicit model** is requested (e.g., `gpt-4`), the capability filter is skipped to honor the user's choice even if the model's stored capabilities don't include `chat`.

## Soft Scores

After passing filters, candidates are scored on:

| Signal | Weight | Description |
|---|---|---|
| Capability match | per-capability | Up to 1.6x for rare capabilities |
| Cost score | up to 20 | Cheaper models score higher |
| Latency score | up to 15 | Faster models score higher |
| Health boost | +10 / -20 / -100 | healthy / degraded / unhealthy |
| Local-first boost | +25 | If `localFirst` is enabled |
| Rule boosts | variable | From routing rules |
| Provider weight | x2 | Configured weight multiplier |

## Composite Score

```
score = capabilityMatch + costScore + latencyScore
        + healthBoost + ruleBoost + weightBoost + localFirstBoost
```

## Fallback

If the selected provider fails, the engine attempts the highest-scored alternative once. Fallback is controlled by the `fallbackEnabled` option.

When the original request uses `stream: true`, the fallback also streams its response so the client receives consistent SSE chunks throughout the entire request lifecycle.

## Local Providers

Providers considered "local" for privacy and local-first routing:
- `ollama`
- `lmstudio`
- `localai`
- `vllm`

## Health States

| Status | Effect |
|---|---|
| `healthy` | +10 score |
| `degraded` | -20 score |
| `unhealthy` | -100 score; skipped if `healthAware: true` |

## Error Handling

If no candidates pass filters, a `RouterError` is thrown with the reason from the best-scoring disqualified candidate.
