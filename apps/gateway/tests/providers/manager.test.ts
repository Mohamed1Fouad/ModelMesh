import { describe, it, expect, vi } from "vitest";
import { ProviderManager } from "../../src/providers/manager.js";

vi.mock("@modelmesh/db", () => ({
  prisma: {
    provider: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    routingRule: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@modelmesh/db";

describe("ProviderManager", () => {
  const manager = new ProviderManager(prisma);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads enabled providers with their models", async () => {
    vi.mocked(prisma.provider.findMany).mockResolvedValue([
      { id: "p1", name: "openai", enabled: true, models: [] },
    ] as any);

    const result = await manager.loadProviders();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("openai");
    expect(prisma.provider.findMany).toHaveBeenCalledWith({
      where: { enabled: true },
      include: { models: { where: { enabled: true } } },
    });
  });

  it("loads enabled routing rules ordered by priority desc", async () => {
    vi.mocked(prisma.routingRule.findMany).mockResolvedValue([
      { id: "r1", name: "prefer-local", priority: 10, enabled: true, condition: {}, action: {} },
      { id: "r2", name: "reject-beta", priority: 5, enabled: true, condition: {}, action: {} },
    ] as any);

    const rules = await manager.loadRules();
    expect(rules).toHaveLength(2);
    expect(rules[0].priority).toBe(10);
    expect(rules[1].priority).toBe(5);
    expect(prisma.routingRule.findMany).toHaveBeenCalledWith({
      where: { enabled: true },
      orderBy: { priority: "desc" },
    });
  });

  it("converts DB provider to ProviderConfig", () => {
    const dbProvider = {
      id: "p1",
      name: "openai",
      enabled: true,
      baseUrl: "https://custom.openai.com/v1",
      apiKey: "sk-test",
      timeoutMs: 15000,
      retries: 2,
      weight: 3,
      models: [
        {
          externalId: "gpt-4o",
          name: "GPT-4o",
          capabilities: ["chat", "streaming"],
          contextWindow: 128000,
          maxTokens: 4096,
          promptPricePer1k: 0.005,
          completionPricePer1k: 0.015,
          currency: "USD",
          supportsStreaming: true,
          supportsToolUse: true,
          latencyTtftMs: 200,
          latencyThroughputTokensPerSec: 80,
          latencyScore: 95,
        },
      ],
    } as any;

    const config = manager.toConfig(dbProvider);
    expect(config.name).toBe("openai");
    expect(config.baseUrl).toBe("https://custom.openai.com/v1");
    expect(config.apiKey).toBe("sk-test");
    expect(config.timeoutMs).toBe(15000);
    expect(config.retries).toBe(2);
    expect(config.weight).toBe(3);
    expect(config.models).toHaveLength(1);
    expect(config.models[0].id).toBe("gpt-4o");
    expect(config.models[0].pricing.promptPer1k).toBe(0.005);
    expect(config.models[0].latencyProfile.ttftMs).toBe(200);
    expect(config.healthCheck.enabled).toBe(true);
  });

  it("handles undefined baseUrl and apiKey in toConfig", () => {
    const dbProvider = {
      id: "p1",
      name: "ollama",
      enabled: true,
      baseUrl: null,
      apiKey: null,
      timeoutMs: 30000,
      retries: 3,
      weight: 1,
      models: [],
    } as any;

    const config = manager.toConfig(dbProvider);
    expect(config.baseUrl).toBeUndefined();
    expect(config.apiKey).toBeUndefined();
    expect(config.models).toHaveLength(0);
  });
});
