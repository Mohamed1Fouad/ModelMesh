import { prisma } from "@modelmesh/db";
import type {
  AgentDefinition,
  AgentRequest,
  AgentResponse,
  AgentToolCall,
  AgentMessage,
} from "@modelmesh/shared";
import type { ChatCompletionBody } from "../schemas.js";
import { createProviderAdapter } from "../providers/factory.js";
import type { ProviderConfig } from "@modelmesh/shared";

export class AgentEngine {
  private toolRegistry = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>();

  registerTool(
    name: string,
    handler: (args: Record<string, unknown>) => Promise<unknown>
  ) {
    this.toolRegistry.set(name, handler);
  }

  async execute(request: AgentRequest): Promise<AgentResponse> {
    const agent = await this.loadAgent(request.agentId);
    if (!agent) {
      throw new AgentError(`Agent not found: ${request.agentId}`);
    }

    const session = await this.getOrCreateSession(agent, request);
    const history = await this.loadSessionMessages(session.id);

    // Inject system prompt if not present
    const messages: AgentMessage[] = [
      { id: "sys", role: "system", content: agent.systemPrompt, createdAt: new Date() },
      ...history,
      ...request.messages.map((m) => ({
        id: crypto.randomUUID(),
        role: m.role as AgentMessage["role"],
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        createdAt: new Date(),
      })),
    ];

    let iteration = 0;
    let done = false;
    let finalContent = "";

    while (!done && iteration < agent.maxIterations) {
      iteration++;

      const providerConfig = await this.getProviderConfig(agent.provider);
      const adapter = createProviderAdapter(agent.provider as ProviderConfig["name"]);

      const body: ChatCompletionBody = {
        model: agent.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
        tools: request.tools?.length ? request.tools : undefined,
        tool_choice: request.tools?.length ? "auto" : undefined,
      };

      const response = await adapter.chatCompletion(body, providerConfig, agent.model);
      const choice = response.choices[0];
      const content = choice?.message?.content ?? "";
      const toolCalls = choice?.message?.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        // Execute tools and continue loop
        const typedToolCalls = toolCalls as Array<{ id: string; function: { name: string; arguments: string } }>;
        messages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: content ?? "",
          toolCalls: typedToolCalls.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          })),
          createdAt: new Date(),
        });

        for (const tc of typedToolCalls) {
          const result = await this.executeTool(tc.function.name, JSON.parse(tc.function.arguments));
          messages.push({
            id: crypto.randomUUID(),
            role: "tool",
            content: typeof result === "string" ? result : JSON.stringify(result),
            toolCallId: tc.id,
            createdAt: new Date(),
          });
        }

        await this.saveMessages(session.id, messages.slice(-toolCalls.length * 2 - 1));
      } else {
        done = true;
        finalContent = content;
        messages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content,
          createdAt: new Date(),
        });
        await this.saveMessages(session.id, [messages[messages.length - 1]]);
      }
    }

    return {
      content: finalContent,
      sessionId: session.id,
      iteration,
      done,
    };
  }

  private async loadAgent(id: string): Promise<AgentDefinition | null> {
    const db = await prisma.agent.findUnique({
      where: { id },
      include: { provider: true, model: true },
    });
    if (!db) return null;

    return {
      id: db.id,
      name: db.name,
      description: db.description ?? undefined,
      systemPrompt: db.systemPrompt,
      provider: db.provider?.name ?? "openai",
      model: db.model?.externalId ?? "gpt-4o",
      tools: db.tools,
      capabilities: db.capabilities,
      memoryEnabled: db.memoryEnabled,
      maxIterations: db.maxIterations,
    };
  }

  private async getOrCreateSession(
    agent: AgentDefinition,
    request: AgentRequest
  ): Promise<{ id: string }> {
    if (request.sessionId) {
      const existing = await prisma.agentSession.findUnique({
        where: { id: request.sessionId },
      });
      if (existing) return { id: existing.id };
    }

    const session = await prisma.agentSession.create({
      data: {
        agentId: agent.id,
        userId: request.userId,
        title: request.messages[0]?.content?.toString().slice(0, 50) ?? "New Session",
      },
    });
    return { id: session.id };
  }

  private async loadSessionMessages(sessionId: string): Promise<AgentMessage[]> {
    const rows = await prisma.agentMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 50, // Keep last 50 messages for context
    });

    return rows.map((r: { id: string; role: string; content: string; toolCalls: unknown; toolCallId: string | null; metadata: unknown; createdAt: Date }) => ({
      id: r.id,
      role: r.role as AgentMessage["role"],
      content: r.content,
      toolCalls: (r.toolCalls as AgentToolCall[]) ?? undefined,
      toolCallId: r.toolCallId ?? undefined,
      metadata: (r.metadata as Record<string, unknown>) ?? undefined,
      createdAt: r.createdAt,
    }));
  }

  private async saveMessages(sessionId: string, messages: AgentMessage[]) {
    for (const m of messages) {
      await prisma.agentMessage.create({
        data: {
          sessionId,
          role: m.role,
          content: m.content,
          toolCalls: m.toolCalls as object ?? undefined,
          toolCallId: m.toolCallId,
          metadata: m.metadata as object ?? undefined,
        },
      });
    }
  }

  private async getProviderConfig(providerName: string): Promise<ProviderConfig> {
    const provider = await prisma.provider.findUnique({
      where: { name: providerName },
      include: { models: true },
    });

    if (!provider) {
      throw new AgentError(`Provider not found: ${providerName}`);
    }

    return {
      name: provider.name as ProviderConfig["name"],
      enabled: provider.enabled,
      baseUrl: provider.baseUrl ?? undefined,
      apiKey: provider.apiKey ?? undefined,
      timeoutMs: provider.timeoutMs,
      retries: provider.retries,
      weight: provider.weight,
      models: provider.models.map((m: { externalId: string; name: string; capabilities: string[]; contextWindow: number; maxTokens: number | null; promptPricePer1k: number; completionPricePer1k: number; currency: string; supportsStreaming: boolean; supportsToolUse: boolean; latencyTtftMs: number; latencyThroughputTokensPerSec: number; latencyScore: number }) => ({
        id: m.externalId,
        provider: provider.name as ProviderConfig["name"],
        name: m.name,
        capabilities: m.capabilities as ProviderConfig["models"][number]["capabilities"],
        contextWindow: m.contextWindow,
        maxTokens: m.maxTokens ?? undefined,
        pricing: {
          promptPer1k: m.promptPricePer1k,
          completionPer1k: m.completionPricePer1k,
          currency: m.currency,
        },
        supportsStreaming: m.supportsStreaming,
        supportsToolUse: m.supportsToolUse,
        latencyProfile: {
          ttftMs: m.latencyTtftMs,
          throughputTokensPerSec: m.latencyThroughputTokensPerSec,
          score: m.latencyScore,
        },
      })),
      healthCheck: { enabled: true, intervalMs: 30000, timeoutMs: provider.timeoutMs },
    };
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const handler = this.toolRegistry.get(name);
    if (!handler) {
      return { error: `Tool not found: ${name}` };
    }
    try {
      return await handler(args);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export class AgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentError";
  }
}