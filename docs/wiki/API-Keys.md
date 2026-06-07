# API Keys

API keys authenticate requests to the ModelMesh gateway. Each key has a name, scopes, and optional rate limits.

## Creating Keys

1. Go to **API Keys** in the dashboard
2. Click **Create Key**
3. Fill in:
   - **Name** — descriptive name (e.g., "Production App")
   - **Scopes** — select permissions via checkboxes
   - **Rate Limits** — optional RPM and TPM limits
   - **Expires At** — optional expiration date
4. Copy the raw key (shown once)

## Scopes

Scopes define what the API key can access. Available scopes:

- `chat:write` — send chat completion requests
- `models:read` — list available models
- `provider:read`, `provider:write` — view and manage providers
- `rule:read`, `rule:write` — view and manage routing rules
- `usage:read` — view usage analytics
- `agent:read`, `agent:write` — view and manage agents
- `workflow:read`, `workflow:write` — view and manage workflows
- `marketplace:read`, `marketplace:write` — view and manage marketplace presets
- `audit:read` — view audit logs
- `team:read`, `team:write` — view and manage teams
- `key:read`, `key:write` — view and manage API keys

Keys without selected scopes default to `chat:write`.

## Authentication

Send the API key in either header format:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "X-API-Key: mm-sk-YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'
```

Or as a Bearer token:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer mm-sk-YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'
```

## Revocation

Click **Revoke** next to any key to immediately invalidate it. Revoked keys cannot be recovered.

## Dashboard Chat Key

The dashboard auto-generates an internal API key for the Chat page. It is recreated on each dashboard session if missing.
