import { prisma } from "@modelmesh/db";
import type { ProviderConfig, ProviderName, RoutingRule } from "@modelmesh/shared";

function isLocalProvider(name: string, baseUrl: string | null): boolean {
  const localNames: ProviderName[] = ["ollama", "lmstudio", "localai", "vllm"];
  if (localNames.includes(name.toLowerCase() as ProviderName)) return true;
  if (baseUrl && /localhost|127\.0\.0\.1|host\.docker\.internal/.test(baseUrl)) return true;
  return false;
}

export class ProviderManager {
  constructor(private db: typeof prisma) {}

  async loadProviders() {
    return this.db.provider.findMany({
      where: { enabled: true },
      include: { models: { where: { enabled: true } } },
    });
  }

  async loadRules(): Promise<RoutingRule[]> {
    const rules = await this.db.routingRule.findMany({
      where: { enabled: true },
      orderBy: { priority: "desc" },
    });
    return rules.map((r: { id: string; name: string; priority: number; enabled: boolean; condition: unknown; action: unknown }) => ({
      id: r.id,
      name: r.name,
      priority: r.priority,
      enabled: r.enabled,
      condition: r.condition as RoutingRule["condition"],
      action: r.action as RoutingRule["action"],
    }));
  }

  toConfig(dbProvider: Awaited<ReturnType<typeof this.loadProviders>>[number]): ProviderConfig {
    return {
      name: dbProvider.name.toLowerCase() as ProviderConfig["name"],
      enabled: dbProvider.enabled,
      baseUrl: dbProvider.baseUrl ?? undefined,
      apiKey: dbProvider.apiKey ?? undefined,
      timeoutMs: dbProvider.timeoutMs,
      retries: dbProvider.retries,
      weight: dbProvider.weight,
      models: dbProvider.models.map((m: { externalId: string; name: string; capabilities: string[]; contextWindow: number; maxTokens: number | null; promptPricePer1k: number; completionPricePer1k: number; currency: string; supportsStreaming: boolean; supportsToolUse: boolean; latencyTtftMs: number; latencyThroughputTokensPerSec: number; latencyScore: number }) => ({
        id: m.externalId,
        provider: dbProvider.name.toLowerCase() as ProviderConfig["name"],
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
      healthCheck: {
        enabled: isLocalProvider(dbProvider.name, dbProvider.baseUrl),
        intervalMs: 30000,
        timeoutMs: dbProvider.timeoutMs,
      },
    };
  }
}
