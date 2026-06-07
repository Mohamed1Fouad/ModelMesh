#!/usr/bin/env node
import { Command } from "commander";
import { ModelMeshClient } from "@modelmesh/sdk";

const program = new Command();

program
  .name("mm")
  .description("ModelMesh CLI — interact with your AI routing gateway")
  .version("0.1.0");

function createClient(options: { url?: string; key?: string }) {
  return new ModelMeshClient({
    baseUrl: options.url || process.env.MODELMESH_URL || "http://localhost:3000",
    apiKey: options.key || process.env.MODELMESH_API_KEY,
  });
}

// Global options that many commands share
function withAuth(cmd: Command) {
  return cmd
    .option("-u, --url <url>", "Gateway URL")
    .option("-k, --key <key>", "API key");
}

// ─── Chat ──────────────────────────────────────────────────────────
program
  .command("chat")
  .description("Send a chat completion request")
  .option("-u, --url <url>", "Gateway URL", process.env.MODELMESH_URL || "http://localhost:3000")
  .option("-k, --key <key>", "API key", process.env.MODELMESH_API_KEY)
  .option("-m, --model <model>", "Model ID", "auto")
  .option("--stream", "Enable streaming", false)
  .option("--system <text>", "System message")
  .option("--temperature <n>", "Temperature", "0.7")
  .option("--max-tokens <n>", "Max tokens")
  .option("--json", "Request JSON mode", false)
  .argument("[message]", "User message")
  .action(async (message, options) => {
    const client = createClient(options);
    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (options.system) messages.push({ role: "system", content: options.system });
    messages.push({ role: "user", content: message || "Hello" });

    const req = {
      model: options.model,
      messages,
      temperature: Number(options.temperature),
      ...(options.maxTokens ? { max_tokens: Number(options.maxTokens) } : {}),
      ...(options.json ? { response_format: { type: "json_object" as const } } : {}),
    };

    if (options.stream) {
      for await (const chunk of client.chatCompletionStream(req)) {
        process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
      }
      process.stdout.write("\n");
    } else {
      const response = await client.chatCompletion(req);
      console.log(response.choices[0]?.message?.content ?? "");
      if (options.model === "auto") {
        console.error(`\n[routed to ${response.model}]`);
      }
    }
  });

// ─── Models (public) ───────────────────────────────────────────────
program
  .command("models")
  .description("List publicly available models")
  .option("-u, --url <url>", "Gateway URL", process.env.MODELMESH_URL || "http://localhost:3000")
  .option("-k, --key <key>", "API key", process.env.MODELMESH_API_KEY)
  .action(async (options) => {
    const client = createClient(options);
    const models = await client.listModels();
    for (const m of models) {
      console.log(`${m.id.padEnd(40)} ${m.owned_by}`);
    }
  });

// ─── Provider ──────────────────────────────────────────────────────
const providerCmd = program.command("provider").description("Manage providers");

withAuth(providerCmd.command("list"))
  .description("List all providers")
  .action(async (options) => {
    const client = createClient(options);
    const providers = await client.listProviders();
    for (const p of providers) {
      const models = (p.models as Array<Record<string, unknown>> | undefined) ?? [];
      console.log(`${String(p.id).padEnd(26)} ${String(p.name).padEnd(12)} ${String(p.displayName).padEnd(20)} ${p.enabled ? "enabled" : "disabled"}  ${models.length} models`);
    }
  });

withAuth(providerCmd.command("get"))
  .description("Get provider details")
  .requiredOption("--id <id>", "Provider ID")
  .action(async (options) => {
    const client = createClient(options);
    const provider = await client.getProvider(options.id);
    console.log(JSON.stringify(provider, null, 2));
  });

withAuth(providerCmd.command("add"))
  .description("Add a new provider")
  .requiredOption("--name <name>", "Provider name (e.g. openai)")
  .requiredOption("--display-name <name>", "Display name (e.g. OpenAI)")
  .option("--base-url <url>", "Base URL")
  .option("--api-key <key>", "API key")
  .option("--timeout <ms>", "Timeout in ms", "30000")
  .option("--retries <n>", "Retries", "3")
  .option("--weight <n>", "Weight", "1")
  .option("--quota <n>", "Monthly quota cost")
  .action(async (options) => {
    const client = createClient(options);
    const provider = await client.createProvider({
      name: options.name,
      displayName: options.displayName,
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      timeoutMs: Number(options.timeout),
      retries: Number(options.retries),
      weight: Number(options.weight),
      monthlyQuotaCost: options.quota ? Number(options.quota) : undefined,
    });
    console.log("Created provider:", provider.id);
  });

withAuth(providerCmd.command("update"))
  .description("Update a provider")
  .requiredOption("--id <id>", "Provider ID")
  .option("--display-name <name>", "Display name")
  .option("--base-url <url>", "Base URL")
  .option("--api-key <key>", "API key")
  .option("--timeout <ms>", "Timeout in ms")
  .option("--retries <n>", "Retries")
  .option("--weight <n>", "Weight")
  .option("--enabled <bool>", "Enabled true/false")
  .option("--quota <n>", "Monthly quota cost")
  .action(async (options) => {
    const client = createClient(options);
    const body: Record<string, unknown> = {};
    if (options.displayName !== undefined) body.displayName = options.displayName;
    if (options.baseUrl !== undefined) body.baseUrl = options.baseUrl;
    if (options.apiKey !== undefined) body.apiKey = options.apiKey;
    if (options.timeout !== undefined) body.timeoutMs = Number(options.timeout);
    if (options.retries !== undefined) body.retries = Number(options.retries);
    if (options.weight !== undefined) body.weight = Number(options.weight);
    if (options.enabled !== undefined) body.enabled = options.enabled === "true";
    if (options.quota !== undefined) body.monthlyQuotaCost = options.quota ? Number(options.quota) : null;
    const provider = await client.updateProvider(options.id, body);
    console.log("Updated provider:", provider.id);
  });

withAuth(providerCmd.command("delete"))
  .description("Delete a provider")
  .requiredOption("--id <id>", "Provider ID")
  .action(async (options) => {
    const client = createClient(options);
    await client.deleteProvider(options.id);
    console.log("Deleted provider:", options.id);
  });

// ─── Model ─────────────────────────────────────────────────────────
const modelCmd = program.command("model").description("Manage models");

withAuth(modelCmd.command("list"))
  .description("List all models")
  .action(async (options) => {
    const client = createClient(options);
    const models = await client.listAdminModels();
    for (const m of models) {
      const provider = m.provider as Record<string, unknown> | undefined;
      console.log(`${String(m.id).padEnd(26)} ${String(m.name).padEnd(22)} ${String(m.externalId).padEnd(30)} ${String(provider?.name ?? "").padEnd(10)} $${Number(m.promptPricePer1k ?? 0).toFixed(4)}/1K`);
    }
  });

withAuth(modelCmd.command("get"))
  .description("Get model details")
  .requiredOption("--id <id>", "Model ID")
  .action(async (options) => {
    const client = createClient(options);
    const model = await client.getModel(options.id);
    console.log(JSON.stringify(model, null, 2));
  });

withAuth(modelCmd.command("add"))
  .description("Add a new model")
  .requiredOption("--provider-id <id>", "Provider ID")
  .requiredOption("--external-id <id>", "External model ID (native provider ID)")
  .requiredOption("--name <name>", "Display name")
  .option("--open-router-id <id>", "OpenRouter ID")
  .option("--context-window <n>", "Context window", "128000")
  .option("--max-tokens <n>", "Max tokens")
  .option("--capabilities <list>", "Comma-separated capabilities", "chat,streaming")
  .option("--streaming", "Supports streaming", true)
  .option("--tool-use", "Supports tool use", false)
  .option("--prompt-price <n>", "Prompt price per 1K tokens", "0")
  .option("--completion-price <n>", "Completion price per 1K tokens", "0")
  .option("--latency <ms>", "Latency TTFT in ms", "500")
  .option("--quota <n>", "Monthly quota cost")
  .action(async (options) => {
    const client = createClient(options);
    const model = await client.createModel({
      providerId: options.providerId,
      externalId: options.externalId,
      openRouterId: options.openRouterId,
      name: options.name,
      contextWindow: Number(options.contextWindow),
      maxTokens: options.maxTokens ? Number(options.maxTokens) : undefined,
      capabilities: options.capabilities.split(",").map((s: string) => s.trim()),
      supportsStreaming: options.streaming,
      supportsToolUse: options.toolUse,
      promptPricePer1k: Number(options.promptPrice),
      completionPricePer1k: Number(options.completionPrice),
      latencyTtftMs: Number(options.latency),
      monthlyQuotaCost: options.quota ? Number(options.quota) : undefined,
    });
    console.log("Created model:", model.id);
  });

withAuth(modelCmd.command("update"))
  .description("Update a model")
  .requiredOption("--id <id>", "Model ID")
  .option("--name <name>", "Display name")
  .option("--external-id <id>", "External model ID")
  .option("--enabled <bool>", "Enabled true/false")
  .option("--quota <n>", "Monthly quota cost")
  .action(async (options) => {
    const client = createClient(options);
    const body: Record<string, unknown> = {};
    if (options.name !== undefined) body.name = options.name;
    if (options.externalId !== undefined) body.externalId = options.externalId;
    if (options.enabled !== undefined) body.enabled = options.enabled === "true";
    if (options.quota !== undefined) body.monthlyQuotaCost = options.quota ? Number(options.quota) : null;
    const model = await client.updateModel(options.id, body);
    console.log("Updated model:", model.id);
  });

withAuth(modelCmd.command("delete"))
  .description("Delete a model")
  .requiredOption("--id <id>", "Model ID")
  .action(async (options) => {
    const client = createClient(options);
    await client.deleteModel(options.id);
    console.log("Deleted model:", options.id);
  });

// ─── Rule ────────────────────────────────────────────────────────────
const ruleCmd = program.command("rule").description("Manage routing rules");

withAuth(ruleCmd.command("list"))
  .description("List all routing rules")
  .action(async (options) => {
    const client = createClient(options);
    const rules = await client.listRules();
    for (const r of rules) {
      console.log(`${String(r.id).padEnd(26)} ${String(r.name).padEnd(20)} pri=${String(r.priority).padEnd(4)} ${r.enabled ? "enabled" : "disabled"}`);
    }
  });

withAuth(ruleCmd.command("get"))
  .description("Get rule details")
  .requiredOption("--id <id>", "Rule ID")
  .action(async (options) => {
    const client = createClient(options);
    const rule = await client.getRule(options.id);
    console.log(JSON.stringify(rule, null, 2));
  });

withAuth(ruleCmd.command("add"))
  .description("Add a routing rule")
  .requiredOption("--name <name>", "Rule name")
  .requiredOption("--condition <json>", "Condition JSON (e.g. '{\"taskType\":\"coding\"}')")
  .requiredOption("--action <json>", "Action JSON (e.g. '{\"routeTo\":\"anthropic\"}')")
  .option("--priority <n>", "Priority", "0")
  .option("--enabled", "Enable rule", true)
  .action(async (options) => {
    const client = createClient(options);
    const rule = await client.createRule({
      name: options.name,
      condition: JSON.parse(options.condition),
      action: JSON.parse(options.action),
      priority: Number(options.priority),
      enabled: options.enabled,
    });
    console.log("Created rule:", rule.id);
  });

withAuth(ruleCmd.command("update"))
  .description("Update a routing rule")
  .requiredOption("--id <id>", "Rule ID")
  .option("--name <name>", "Rule name")
  .option("--condition <json>", "Condition JSON")
  .option("--action <json>", "Action JSON")
  .option("--priority <n>", "Priority")
  .option("--enabled <bool>", "Enabled true/false")
  .action(async (options) => {
    const client = createClient(options);
    const body: Record<string, unknown> = {};
    if (options.name !== undefined) body.name = options.name;
    if (options.condition !== undefined) body.condition = JSON.parse(options.condition);
    if (options.action !== undefined) body.action = JSON.parse(options.action);
    if (options.priority !== undefined) body.priority = Number(options.priority);
    if (options.enabled !== undefined) body.enabled = options.enabled === "true";
    const rule = await client.updateRule(options.id, body);
    console.log("Updated rule:", rule.id);
  });

withAuth(ruleCmd.command("delete"))
  .description("Delete a routing rule")
  .requiredOption("--id <id>", "Rule ID")
  .action(async (options) => {
    const client = createClient(options);
    await client.deleteRule(options.id);
    console.log("Deleted rule:", options.id);
  });

withAuth(ruleCmd.command("toggle"))
  .description("Enable/disable a routing rule")
  .requiredOption("--id <id>", "Rule ID")
  .requiredOption("--enabled <bool>", "true or false")
  .action(async (options) => {
    const client = createClient(options);
    const rule = await client.updateRule(options.id, { enabled: options.enabled === "true" });
    console.log(`${rule.enabled ? "Enabled" : "Disabled"} rule:`, rule.id);
  });

// ─── Key ───────────────────────────────────────────────────────────
const keyCmd = program.command("key").description("Manage API keys");

withAuth(keyCmd.command("list"))
  .description("List all API keys")
  .action(async (options) => {
    const client = createClient(options);
    const keys = await client.listApiKeys();
    for (const k of keys) {
      console.log(`${String(k.id).padEnd(26)} ${String(k.name).padEnd(20)} ${String(k.keyPrefix).padEnd(10)} scopes=${(k.scopes as string[]).join(",")}`);
    }
  });

withAuth(keyCmd.command("add"))
  .description("Create a new API key")
  .requiredOption("--name <name>", "Key name")
  .option("--scopes <list>", "Comma-separated scopes", "chat:write")
  .option("--rpm <n>", "Rate limit RPM")
  .option("--tpm <n>", "Rate limit TPM")
  .option("--expires <iso>", "Expiration ISO date")
  .action(async (options) => {
    const client = createClient(options);
    const key = await client.createApiKey({
      name: options.name,
      scopes: options.scopes.split(",").map((s: string) => s.trim()),
      rateLimitRpm: options.rpm ? Number(options.rpm) : undefined,
      rateLimitTpm: options.tpm ? Number(options.tpm) : undefined,
      expiresAt: options.expires ? new Date(options.expires).toISOString() : undefined,
    });
    console.log("Created API key:", key.key);
    console.log("ID:", key.id);
  });

withAuth(keyCmd.command("revoke"))
  .description("Revoke an API key")
  .requiredOption("--id <id>", "Key ID")
  .action(async (options) => {
    const client = createClient(options);
    await client.revokeApiKey(options.id);
    console.log("Revoked key:", options.id);
  });

// ─── Catalog ───────────────────────────────────────────────────────
const catalogCmd = program.command("catalog").description("Browse provider model catalog");

withAuth(catalogCmd.command("list"))
  .description("List catalog entries")
  .option("--provider <name>", "Filter by provider")
  .action(async (options) => {
    const client = createClient(options);
    const entries = await client.getCatalog(options.provider);
    for (const e of entries) {
      console.log(`${String(e.providerName).padEnd(12)} ${String(e.name).padEnd(30)} ${String(e.externalId).padEnd(30)} $${Number(e.promptPricePer1k ?? 0).toFixed(4)}/1K`);
    }
  });

// ─── Team ──────────────────────────────────────────────────────────
const teamCmd = program.command("team").description("Manage teams");

withAuth(teamCmd.command("list"))
  .description("List all teams")
  .action(async (options) => {
    const client = createClient(options);
    const teams = await client.listTeams();
    for (const t of teams) {
      console.log(`${String(t.id).padEnd(26)} ${String(t.name).padEnd(20)} ${t.slug}`);
    }
  });

withAuth(teamCmd.command("get"))
  .description("Get team details")
  .requiredOption("--id <id>", "Team ID")
  .action(async (options) => {
    const client = createClient(options);
    const team = await client.getTeam(options.id);
    console.log(JSON.stringify(team, null, 2));
  });

withAuth(teamCmd.command("create"))
  .description("Create a team")
  .requiredOption("--name <name>", "Team name")
  .requiredOption("--slug <slug>", "Team slug")
  .option("--description <text>", "Description")
  .action(async (options) => {
    const client = createClient(options);
    const team = await client.createTeam({
      name: options.name,
      slug: options.slug,
      description: options.description,
    });
    console.log("Created team:", team.id);
  });

withAuth(teamCmd.command("update"))
  .description("Update a team")
  .requiredOption("--id <id>", "Team ID")
  .option("--name <name>", "Team name")
  .option("--description <text>", "Description")
  .option("--enabled <bool>", "Enabled true/false")
  .action(async (options) => {
    const client = createClient(options);
    const body: Record<string, unknown> = {};
    if (options.name !== undefined) body.name = options.name;
    if (options.description !== undefined) body.description = options.description;
    if (options.enabled !== undefined) body.enabled = options.enabled === "true";
    const team = await client.updateTeam(options.id, body);
    console.log("Updated team:", team.id);
  });

withAuth(teamCmd.command("delete"))
  .description("Delete a team")
  .requiredOption("--id <id>", "Team ID")
  .action(async (options) => {
    const client = createClient(options);
    await client.deleteTeam(options.id);
    console.log("Deleted team:", options.id);
  });

withAuth(teamCmd.command("invite"))
  .description("Invite a member to a team")
  .requiredOption("--id <id>", "Team ID")
  .requiredOption("--email <email>", "Member email")
  .option("--role <role>", "Role (owner/admin/developer/viewer)", "developer")
  .action(async (options) => {
    const client = createClient(options);
    const invitation = await client.createInvitation(options.id, { email: options.email, role: options.role });
    console.log("Invitation token:", invitation.token);
  });

// ─── Marketplace ───────────────────────────────────────────────────
const marketplaceCmd = program.command("marketplace").description("Browse marketplace presets");

withAuth(marketplaceCmd.command("list"))
  .description("List marketplace presets")
  .action(async (options) => {
    const client = createClient(options);
    const presets = await client.listMarketplace();
    for (const p of presets) {
      console.log(`${String(p.id).padEnd(26)} ${String(p.name).padEnd(25)} ${String(p.providerName).padEnd(12)} ${p.category}`);
    }
  });

withAuth(marketplaceCmd.command("get"))
  .description("Get preset details")
  .requiredOption("--id <id>", "Preset ID")
  .action(async (options) => {
    const client = createClient(options);
    const preset = await client.getPreset(options.id);
    console.log(JSON.stringify(preset, null, 2));
  });

withAuth(marketplaceCmd.command("install"))
  .description("Install a marketplace preset")
  .requiredOption("--id <id>", "Preset ID")
  .action(async (options) => {
    const client = createClient(options);
    const result = await client.installPreset(options.id);
    console.log("Installed:", result);
  });

// ─── Agent ─────────────────────────────────────────────────────────
const agentCmd = program.command("agent").description("Manage agents");

withAuth(agentCmd.command("list"))
  .description("List all agents")
  .action(async (options) => {
    const client = createClient(options);
    const agents = await client.listAgents();
    for (const a of agents) {
      console.log(`${String(a.id).padEnd(26)} ${String(a.name).padEnd(20)} ${a.enabled ? "enabled" : "disabled"}`);
    }
  });

withAuth(agentCmd.command("get"))
  .description("Get agent details")
  .requiredOption("--id <id>", "Agent ID")
  .action(async (options) => {
    const client = createClient(options);
    const agent = await client.getAgent(options.id);
    console.log(JSON.stringify(agent, null, 2));
  });

withAuth(agentCmd.command("run"))
  .description("Execute an agent")
  .requiredOption("--id <id>", "Agent ID")
  .option("--input <json>", "Input JSON", "{}")
  .action(async (options) => {
    const client = createClient(options);
    const result = await client.executeAgent(options.id, JSON.parse(options.input));
    console.log(JSON.stringify(result, null, 2));
  });

// ─── Workflow ──────────────────────────────────────────────────────
const workflowCmd = program.command("workflow").description("Manage workflows");

withAuth(workflowCmd.command("list"))
  .description("List all workflows")
  .action(async (options) => {
    const client = createClient(options);
    const workflows = await client.listWorkflows();
    for (const w of workflows) {
      console.log(`${String(w.id).padEnd(26)} ${String(w.name).padEnd(20)} ${w.enabled ? "enabled" : "disabled"}`);
    }
  });

withAuth(workflowCmd.command("get"))
  .description("Get workflow details")
  .requiredOption("--id <id>", "Workflow ID")
  .action(async (options) => {
    const client = createClient(options);
    const workflow = await client.getWorkflow(options.id);
    console.log(JSON.stringify(workflow, null, 2));
  });

withAuth(workflowCmd.command("run"))
  .description("Execute a workflow")
  .requiredOption("--id <id>", "Workflow ID")
  .option("--input <json>", "Input JSON", "{}")
  .action(async (options) => {
    const client = createClient(options);
    const result = await client.executeWorkflow(options.id, JSON.parse(options.input));
    console.log(JSON.stringify(result, null, 2));
  });

// ─── Audit ─────────────────────────────────────────────────────────
withAuth(program.command("audit"))
  .description("Show audit logs")
  .option("--user-id <id>", "Filter by user ID")
  .option("--team-id <id>", "Filter by team ID")
  .option("--action <action>", "Filter by action")
  .option("--resource <resource>", "Filter by resource")
  .option("--limit <n>", "Limit", "100")
  .option("--offset <n>", "Offset", "0")
  .action(async (options) => {
    const client = createClient(options);
    const logs = await client.getAuditLogs({
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.teamId ? { teamId: options.teamId } : {}),
      ...(options.action ? { action: options.action } : {}),
      ...(options.resource ? { resource: options.resource } : {}),
      limit: Number(options.limit),
      offset: Number(options.offset),
    });
    console.log(`Total: ${logs.total}`);
    for (const log of logs.data as Array<Record<string, unknown>>) {
      console.log(`${String(log.timestamp).padEnd(25)} ${String(log.action).padEnd(15)} ${String(log.resource).padEnd(15)} ${log.userId ?? ""}`);
    }
  });

// ─── Refresh ───────────────────────────────────────────────────────
withAuth(program.command("refresh"))
  .description("Reload provider configuration from database")
  .action(async (options) => {
    const client = createClient(options);
    await client.refreshProviders();
    console.log("Providers refreshed");
  });

// ─── Usage ───────────────────────────────────────────────────────────
withAuth(program.command("usage"))
  .description("Show usage statistics")
  .action(async (options) => {
    const client = createClient(options);
    const stats = await client.getUsageStats();
    console.log("Requests:", stats.totalRequests);
    console.log("Total cost: $", Number(stats.totalCost).toFixed(4));
    console.log("Avg latency:", stats.averageLatencyMs, "ms");
    const byProvider = stats.byProvider as Array<Record<string, unknown>> | undefined;
    if (byProvider && byProvider.length > 0) {
      console.log("\nBy provider:");
      for (const p of byProvider) {
        console.log(`  ${String(p.providerName).padEnd(15)} req=${p.requests} cost=$${Number(p.cost).toFixed(4)}`);
      }
    }
  });

// ─── Health ────────────────────────────────────────────────────────
withAuth(program.command("health"))
  .description("Show provider health status")
  .action(async (options) => {
    const client = createClient(options);
    const health = await client.getHealth();
    console.log(JSON.stringify(health, null, 2));
  });

// ─── Config ────────────────────────────────────────────────────────
program
  .command("config")
  .description("Show current configuration")
  .action(() => {
    console.log("Gateway URL:", process.env.MODELMESH_URL || "http://localhost:3000");
    console.log("API Key:", process.env.MODELMESH_API_KEY ? "[set]" : "[not set]");
  });

program.parse();
