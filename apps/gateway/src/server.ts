import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { v4 as uuidv4 } from "uuid";
import { randomBytes, createHash } from "crypto";
import { RouterEngine, HealthMonitor } from "@modelmesh/router";
import { prisma } from "@modelmesh/db";
import type {
  RoutingRequest,
  ChatMessage,
  ToolDefinition,
  TaskType,
  ModelCapability,
} from "@modelmesh/shared";
import { chatCompletionSchema } from "./schemas.js";
import { ProviderManager } from "./providers/manager.js";
import { createProviderAdapter } from "./providers/factory.js";
import { streamTransformer } from "./stream-transformer.js";
import { registerAgentRoutes } from "./agents/routes.js";
import { registerTeamRoutes } from "./teams/routes.js";
import { registerMarketplaceRoutes } from "./marketplace/routes.js";
import { auditLogMiddleware } from "./audit/middleware.js";
import { authMiddleware, requirePermission } from "./auth/middleware.js";

const fastify = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? "info" },
});

await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN ?? "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
});

const providerManager = new ProviderManager(prisma);
const engine = new RouterEngine({
  rules: [],
  providers: [],
  localFirst: process.env.LOCAL_FIRST === "true",
  budgetAware: true,
  fallbackEnabled: true,
  healthAware: true,
});

const healthMonitor = new HealthMonitor({
  checkIntervalMs: Number(process.env.HEALTH_CHECK_INTERVAL_MS ?? "30000"),
  timeoutMs: Number(process.env.HEALTH_CHECK_TIMEOUT_MS ?? "10000"),
  failureThreshold: Number(process.env.HEALTH_FAILURE_THRESHOLD ?? "3"),
  onStatusChange: (provider, prev, curr) => {
    fastify.log.warn(`Provider ${provider} health changed: ${prev} -> ${curr}`);
    prisma.provider.findUnique({ where: { name: provider } }).then((p: { id: string } | null) => {
      if (p) {
        prisma.healthLog.create({
          data: {
            providerId: p.id,
            status: curr,
            latencyMs: 0,
            errorRate: curr === "unhealthy" ? 1 : 0,
            successRate: curr === "healthy" ? 1 : 0,
          },
        }).catch(() => {});
      }
    }).catch(() => {});
  },
});

async function refreshProviders() {
  const dbProviders = await providerManager.loadProviders();
  const configs = dbProviders.map((p: typeof dbProviders[number]) => providerManager.toConfig(p));
  engine["options"].providers = configs;
  engine["options"].rules = await providerManager.loadRules();
  healthMonitor.stop();
  healthMonitor.start(configs);
}

await refreshProviders();
setInterval(refreshProviders, 60000);

fastify.get("/health", async () => ({ status: "ok", uptime: process.uptime() }));

fastify.post("/v1/admin/refresh-providers", async (_request, reply) => {
  await refreshProviders();
  return reply.send({ refreshed: true });
});

// Admin provider CRUD
fastify.get("/v1/admin/providers", { preHandler: [authMiddleware, requirePermission("provider:read")] }, async (_request, reply) => {
  const providers = await prisma.provider.findMany({ include: { models: true }, orderBy: { name: "asc" } });
  return reply.send({ data: providers });
});

fastify.post("/v1/admin/providers", { preHandler: [authMiddleware, requirePermission("provider:write")] }, async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  const provider = await prisma.provider.create({
    data: {
      name: String(body.name),
      displayName: String(body.displayName),
      baseUrl: body.baseUrl ? String(body.baseUrl) : null,
      apiKey: body.apiKey ? String(body.apiKey) : null,
      timeoutMs: Number(body.timeoutMs ?? 30000),
      retries: Number(body.retries ?? 3),
      weight: Number(body.weight ?? 1),
      enabled: body.enabled !== false,
    },
  });
  await refreshProviders();
  return reply.status(201).send(provider);
});

fastify.put("/v1/admin/providers/:id", { preHandler: [authMiddleware, requirePermission("provider:write")] }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (body.displayName !== undefined) data.displayName = String(body.displayName);
  if (body.baseUrl !== undefined) data.baseUrl = body.baseUrl ? String(body.baseUrl) : null;
  if (body.apiKey !== undefined) data.apiKey = body.apiKey ? String(body.apiKey) : null;
  if (body.timeoutMs !== undefined) data.timeoutMs = Number(body.timeoutMs);
  if (body.retries !== undefined) data.retries = Number(body.retries);
  if (body.weight !== undefined) data.weight = Number(body.weight);
  if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
  if (body.monthlyQuotaCost !== undefined) data.monthlyQuotaCost = body.monthlyQuotaCost === null ? null : Number(body.monthlyQuotaCost);
  const provider = await prisma.provider.update({ where: { id }, data });
  await refreshProviders();
  return reply.send(provider);
});

fastify.delete("/v1/admin/providers/:id", { preHandler: [authMiddleware, requirePermission("provider:write")] }, async (request, reply) => {
  const { id } = request.params as { id: string };
  await prisma.provider.delete({ where: { id } });
  await refreshProviders();
  return reply.status(204).send();
});

// Get single provider
fastify.get("/v1/admin/providers/:id", { preHandler: [authMiddleware, requirePermission("provider:read")] }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const provider = await prisma.provider.findUnique({ where: { id }, include: { models: true } });
  if (!provider) return reply.status(404).send({ error: { message: "Provider not found", type: "not_found" } });
  return reply.send(provider);
});

// Admin model CRUD
fastify.get("/v1/admin/models", { preHandler: [authMiddleware, requirePermission("provider:read")] }, async (_request, reply) => {
  const models = await prisma.model.findMany({ include: { provider: true }, orderBy: { name: "asc" } });
  return reply.send({ data: models });
});

fastify.post("/v1/admin/models", { preHandler: [authMiddleware, requirePermission("provider:write")] }, async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  const model = await prisma.model.create({
    data: {
      providerId: String(body.providerId),
      externalId: String(body.externalId),
      openRouterId: body.openRouterId ? String(body.openRouterId) : null,
      name: String(body.name),
      contextWindow: Number(body.contextWindow ?? 128000),
      maxTokens: body.maxTokens ? Number(body.maxTokens) : null,
      capabilities: Array.isArray(body.capabilities) ? (body.capabilities as string[]) : ["chat", "streaming"],
      supportsStreaming: body.supportsStreaming !== false,
      supportsToolUse: body.supportsToolUse === true,
      promptPricePer1k: Number(body.promptPricePer1k ?? 0),
      completionPricePer1k: Number(body.completionPricePer1k ?? 0),
      latencyTtftMs: Number(body.latencyTtftMs ?? 500),
      enabled: body.enabled !== false,
    },
  });
  await refreshProviders();
  return reply.status(201).send(model);
});

fastify.put("/v1/admin/models/:id", { preHandler: [authMiddleware, requirePermission("provider:write")] }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name);
  if (body.externalId !== undefined) data.externalId = String(body.externalId);
  if (body.openRouterId !== undefined) data.openRouterId = body.openRouterId ? String(body.openRouterId) : null;
  if (body.contextWindow !== undefined) data.contextWindow = Number(body.contextWindow);
  if (body.maxTokens !== undefined) data.maxTokens = body.maxTokens ? Number(body.maxTokens) : null;
  if (body.capabilities !== undefined) data.capabilities = Array.isArray(body.capabilities) ? body.capabilities : ["chat", "streaming"];
  if (body.supportsStreaming !== undefined) data.supportsStreaming = Boolean(body.supportsStreaming);
  if (body.supportsToolUse !== undefined) data.supportsToolUse = Boolean(body.supportsToolUse);
  if (body.promptPricePer1k !== undefined) data.promptPricePer1k = Number(body.promptPricePer1k);
  if (body.completionPricePer1k !== undefined) data.completionPricePer1k = Number(body.completionPricePer1k);
  if (body.latencyTtftMs !== undefined) data.latencyTtftMs = Number(body.latencyTtftMs);
  if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
  if (body.monthlyQuotaCost !== undefined) data.monthlyQuotaCost = body.monthlyQuotaCost === null ? null : Number(body.monthlyQuotaCost);
  const model = await prisma.model.update({ where: { id }, data });
  await refreshProviders();
  return reply.send(model);
});

fastify.delete("/v1/admin/models/:id", { preHandler: [authMiddleware, requirePermission("provider:write")] }, async (request, reply) => {
  const { id } = request.params as { id: string };
  await prisma.model.delete({ where: { id } });
  await refreshProviders();
  return reply.status(204).send();
});

// Get single model
fastify.get("/v1/admin/models/:id", { preHandler: [authMiddleware, requirePermission("provider:read")] }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const model = await prisma.model.findUnique({ where: { id }, include: { provider: true } });
  if (!model) return reply.status(404).send({ error: { message: "Model not found", type: "not_found" } });
  return reply.send(model);
});

fastify.get("/v1/models", async (_request, reply) => {
  const dbModels = await prisma.model.findMany({
    where: { enabled: true },
    include: { provider: true },
  });

  const models = dbModels.map((m: { provider: { name: string; displayName: string }; externalId: string; createdAt: Date }) => ({
    id: `${m.provider.name}/${m.externalId}`,
    object: "model",
    created: Math.floor(m.createdAt.getTime() / 1000),
    owned_by: m.provider.displayName,
    permission: [],
    root: m.externalId,
    parent: null,
  }));

  return reply.send({ object: "list", data: models });
});

// Admin routing rules CRUD
fastify.get("/v1/admin/rules", { preHandler: [authMiddleware, requirePermission("provider:read")] }, async (_request, reply) => {
  const rules = await prisma.routingRule.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  return reply.send({ data: rules });
});

fastify.post("/v1/admin/rules", { preHandler: [authMiddleware, requirePermission("provider:write")] }, async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  const rule = await prisma.routingRule.create({
    data: {
      name: String(body.name),
      priority: Number(body.priority ?? 0),
      condition: body.condition as object,
      action: body.action as object,
      enabled: body.enabled !== false,
    },
  });
  await refreshProviders();
  return reply.status(201).send(rule);
});

fastify.put("/v1/admin/rules/:id", { preHandler: [authMiddleware, requirePermission("provider:write")] }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name);
  if (body.priority !== undefined) data.priority = Number(body.priority);
  if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
  if (body.condition !== undefined) data.condition = body.condition as object;
  if (body.action !== undefined) data.action = body.action as object;
  const rule = await prisma.routingRule.update({ where: { id }, data });
  await refreshProviders();
  return reply.send(rule);
});

fastify.delete("/v1/admin/rules/:id", { preHandler: [authMiddleware, requirePermission("provider:write")] }, async (request, reply) => {
  const { id } = request.params as { id: string };
  await prisma.routingRule.delete({ where: { id } });
  await refreshProviders();
  return reply.status(204).send();
});

// Get single rule
fastify.get("/v1/admin/rules/:id", { preHandler: [authMiddleware, requirePermission("provider:read")] }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const rule = await prisma.routingRule.findUnique({ where: { id } });
  if (!rule) return reply.status(404).send({ error: { message: "Rule not found", type: "not_found" } });
  return reply.send(rule);
});

// Admin API keys CRUD
fastify.get("/v1/admin/api-keys", { preHandler: [authMiddleware, requirePermission("provider:read")] }, async (_request, reply) => {
  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, keyPrefix: true, scopes: true, rateLimitRpm: true, rateLimitTpm: true, expiresAt: true, lastUsedAt: true, usageCount: true, createdAt: true },
  });
  return reply.send({ data: keys });
});

fastify.post("/v1/admin/api-keys", { preHandler: [authMiddleware, requirePermission("provider:write")] }, async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  const rawKey = `mm-${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 8);
  const key = await prisma.apiKey.create({
    data: {
      name: String(body.name),
      keyHash,
      keyPrefix,
      scopes: Array.isArray(body.scopes) ? (body.scopes as string[]) : ["chat:write"],
      rateLimitRpm: body.rateLimitRpm ? Number(body.rateLimitRpm) : null,
      rateLimitTpm: body.rateLimitTpm ? Number(body.rateLimitTpm) : null,
      expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : null,
    },
  });
  return reply.status(201).send({ id: key.id, name: key.name, key: rawKey, keyPrefix, scopes: key.scopes, createdAt: key.createdAt });
});

fastify.delete("/v1/admin/api-keys/:id", { preHandler: [authMiddleware, requirePermission("provider:write")] }, async (request, reply) => {
  const { id } = request.params as { id: string };
  await prisma.apiKey.delete({ where: { id } });
  return reply.status(204).send();
});

// Provider model catalog
fastify.get("/v1/admin/catalog", { preHandler: [authMiddleware, requirePermission("provider:read")] }, async (request, reply) => {
  const query = request.query as Record<string, string>;
  const catalog = await prisma.providerModelCatalog.findMany({
    where: {
      enabled: true,
      ...(query.provider ? { providerName: query.provider.toLowerCase() } : {}),
    },
    orderBy: { name: "asc" },
  });
  return reply.send({ data: catalog });
});

fastify.post("/v1/chat/completions", async (request, reply) => {
  const parsed = chatCompletionSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: { message: parsed.error.message, type: "invalid_request_error" } });
  }

  const body = parsed.data;
  const reqId = uuidv4();

  const taskType = inferTaskType(body.messages, body.tools);
  const requiredCapabilities = inferCapabilities(body);

  const routingRequest: RoutingRequest = {
    id: reqId,
    timestamp: new Date(),
    taskType,
    messages: body.messages as ChatMessage[],
    model: body.model,
    requiredCapabilities,
    maxPricePer1k: undefined,
    maxLatencyMs: undefined,
    privacyRequired: body.privacy === true,
    stream: body.stream === true,
    tools: body.tools as ToolDefinition[],
    responseFormat: body.response_format?.type,
    estimatedTokens: body.max_tokens,
  };

  engine.updateHealth(healthMonitor.getState());
  const route = await engine.route(routingRequest);

  fastify.log.info(`[${reqId}] Routed to ${route.selectedProvider}/${route.selectedModel} (score: ${route.score})`);

  const adapter = createProviderAdapter(route.selectedProvider);
  const providerConfig = engine["options"].providers.find((p: { name: string }) => p.name === route.selectedProvider);

  if (!providerConfig) {
    return reply.status(500).send({ error: { message: "Provider config not found", type: "server_error" } });
  }

  const startTime = Date.now();
  let status: "success" | "error" = "success";
  let errorMessage: string | undefined;
  let promptTokens = 0;
  let completionTokens = 0;

  try {
    if (body.stream) {
      const stream = await adapter.chatCompletionStream(body, providerConfig, route.selectedModel);
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      });

      for await (const chunk of streamTransformer(stream, route.selectedModel, reqId)) {
        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens;
          completionTokens = chunk.usage.completion_tokens;
        }
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      reply.raw.write("data: [DONE]\n\n");
      reply.raw.end();
      return;
    }

    const response = await adapter.chatCompletion(body, providerConfig, route.selectedModel);
    promptTokens = response.usage?.prompt_tokens ?? 0;
    completionTokens = response.usage?.completion_tokens ?? 0;
    return reply.send(response);
  } catch (err) {
    status = "error";
    errorMessage = err instanceof Error ? err.message : String(err);
    fastify.log.error(`[${reqId}] Provider error: ${errorMessage}`);

    if (reply.raw.headersSent) {
      reply.raw.write(`data: ${JSON.stringify({ error: { message: errorMessage, type: "provider_error", code: "streaming_failed" } })}\n\n`);
      reply.raw.end();
      return;
    }

    if (engine["options"].fallbackEnabled && route.alternatives.length > 0) {
      const fallback = route.alternatives[0];
      fastify.log.info(`[${reqId}] Fallback to ${fallback.provider}/${fallback.model}`);
      const fallbackAdapter = createProviderAdapter(fallback.provider);
      const fallbackConfig = engine["options"].providers.find((p: { name: string }) => p.name === fallback.provider);
      if (fallbackConfig) {
        try {
          if (body.stream) {
            const fbStream = await fallbackAdapter.chatCompletionStream(body, fallbackConfig, fallback.model);
            reply.raw.writeHead(200, {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            });
            for await (const chunk of streamTransformer(fbStream, fallback.model, reqId)) {
              if (chunk.usage) {
                promptTokens = chunk.usage.prompt_tokens;
                completionTokens = chunk.usage.completion_tokens;
              }
              reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
            }
            reply.raw.write("data: [DONE]\n\n");
            reply.raw.end();
            status = "success";
            return;
          }
          const fbResponse = await fallbackAdapter.chatCompletion(body, fallbackConfig, fallback.model);
          promptTokens = fbResponse.usage?.prompt_tokens ?? 0;
          completionTokens = fbResponse.usage?.completion_tokens ?? 0;
          status = "success";
          return reply.send(fbResponse);
        } catch (fbErr) {
          errorMessage = fbErr instanceof Error ? fbErr.message : String(fbErr);
        }
      }
    }

    const finalMessage = route.alternatives.length > 0
      ? `Primary provider failed (${route.selectedProvider}/${route.selectedModel}), fallback to ${route.alternatives[0].provider}/${route.alternatives[0].model} also failed: ${errorMessage}`
      : errorMessage;

    return reply.status(502).send({
      error: {
        message: finalMessage,
        type: "provider_error",
        code: "routing_failed",
      },
    });
  } finally {
    const latencyMs = Date.now() - startTime;
    const modelRecord = await prisma.model.findFirst({
      where: { externalId: route.selectedModel },
    });
    const providerRecord = await prisma.provider.findFirst({
      where: { name: route.selectedProvider },
    });

    await prisma.usageLog.create({
      data: {
        requestId: reqId,
        providerId: providerRecord?.id ?? "",
        modelId: modelRecord?.id ?? "",
        taskType,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        cost: estimateCost(promptTokens, completionTokens, modelRecord),
        latencyMs,
        status,
        errorMessage,
        routingReason: route.routeReason,
        score: route.score,
      },
    });
  }
});

fastify.post("/v1/embeddings", async (_request, reply) => {
  return reply.status(501).send({ error: { message: "Embeddings not yet implemented", type: "not_implemented" } });
});

fastify.get("/v1/dashboard/health", { preHandler: [authMiddleware, requirePermission("usage:read")] }, async (_request, reply) => {
  const health = healthMonitor.getState();
  return reply.send({ health });
});

fastify.get("/v1/dashboard/stats", { preHandler: [authMiddleware, requirePermission("usage:read")] }, async (_request, reply) => {
  const totalRequests = await prisma.usageLog.count();
  const totalCost = await prisma.usageLog.aggregate({ _sum: { cost: true } });
  const avgLatency = await prisma.usageLog.aggregate({ _avg: { latencyMs: true } });
  return reply.send({
    totalRequests,
    totalCost: totalCost._sum.cost ?? 0,
    averageLatencyMs: Math.round(avgLatency._avg.latencyMs ?? 0),
  });
});

// Global audit logging hook
fastify.addHook("onRequest", auditLogMiddleware);

// Register team routes
await registerTeamRoutes(fastify);

// Register marketplace routes
await registerMarketplaceRoutes(fastify);

// Audit log read route
fastify.get("/v1/audit-logs", { preHandler: [authMiddleware, requirePermission("audit:read")] }, async (request, reply) => {
  const query = request.query as Record<string, string>;
  const logs = await prisma.auditLog.findMany({
    where: {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.teamId ? { teamId: query.teamId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.resource ? { resource: query.resource } : {}),
    },
    orderBy: { timestamp: "desc" },
    take: Number(query.limit ?? "100"),
    skip: Number(query.offset ?? "0"),
  });
  const total = await prisma.auditLog.count({
    where: {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.teamId ? { teamId: query.teamId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.resource ? { resource: query.resource } : {}),
    },
  });
  return reply.send({ data: logs, total });
});

// Register agent routes
await registerAgentRoutes(fastify);

const port = Number(process.env.GATEWAY_PORT ?? "3000");
await fastify.listen({ port, host: "0.0.0.0" });
fastify.log.info(`ModelMesh Gateway listening on http://0.0.0.0:${port}`);

function inferTaskType(messages: unknown[], tools?: unknown[]): TaskType {
  const content = JSON.stringify(messages).toLowerCase();
  if (tools && tools.length > 0) return "agent_orchestration";
  if (content.includes("code") || content.includes("function") || content.includes("bug")) return "coding";
  if (content.includes("summarize") || content.includes("summary")) return "summarization";
  if (content.includes("translate") || content.includes("translation")) return "translation";
  if (content.includes("classify") || content.includes("category")) return "classification";
  if (content.includes("think") || content.includes("reason") || content.includes("step by step")) return "reasoning";
  return "chat";
}

function inferCapabilities(body: Record<string, unknown>): ModelCapability[] {
  const caps: ModelCapability[] = ["chat"];
  if (body.tools) caps.push("tool_use", "function_calling");
  if (body.stream) caps.push("streaming");
  const responseFormat = body.response_format as { type?: string } | undefined;
  if (responseFormat?.type === "json_object") caps.push("json_mode");
  const msgs = body.messages as Array<Record<string, unknown>>;
  if (msgs?.some((m) => Array.isArray(m.content))) caps.push("vision", "multimodal");
  return caps;
}

function estimateCost(promptTokens: number, completionTokens: number, model: { promptPricePer1k: number; completionPricePer1k: number } | null): number {
  if (!model) return 0;
  return (promptTokens / 1000) * model.promptPricePer1k + (completionTokens / 1000) * model.completionPricePer1k;
}