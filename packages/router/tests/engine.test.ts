import { describe, it, expect } from "vitest";
import { RouterEngine, RouterError } from "../src/engine.js";
import type {
  ProviderConfig,
  ProviderHealth,
  RoutingRequest,
  RoutingRule,
} from "@modelmesh/shared";

function makeProvider(
  overrides: Partial<ProviderConfig> & { name: ProviderConfig["name"] }
): ProviderConfig {
  return {
    name: overrides.name,
    enabled: true,
    timeoutMs: 30000,
    retries: 3,
    weight: 1,
    models: [],
    healthCheck: { enabled: true, intervalMs: 30000, timeoutMs: 30000 },
    ...overrides,
    models: overrides.models ?? [],
  };
}

function makeModel(overrides: {
  id: string;
  capabilities?: string[];
  contextWindow?: number;
  promptPricePer1k?: number;
  completionPricePer1k?: number;
  latencyTtftMs?: number;
  latencyThroughputTokensPerSec?: number;
  latencyScore?: number;
  maxTokens?: number;
}) {
  return {
    id: overrides.id,
    provider: "openai" as const,
    name: overrides.id,
    capabilities: (overrides.capabilities ?? ["chat"]) as any,
    contextWindow: overrides.contextWindow ?? 128_000,
    maxTokens: overrides.maxTokens ?? 4096,
    pricing: {
      promptPer1k: overrides.promptPricePer1k ?? 0.002,
      completionPer1k: overrides.completionPricePer1k ?? 0.01,
      currency: "USD",
    },
    supportsStreaming: true,
    supportsToolUse: false,
    latencyProfile: {
      ttftMs: overrides.latencyTtftMs ?? 500,
      throughputTokensPerSec: overrides.latencyThroughputTokensPerSec ?? 50,
      score: overrides.latencyScore ?? 50,
    },
  };
}

function makeRequest(overrides: Partial<RoutingRequest> = {}): RoutingRequest {
  return {
    id: "req-1",
    timestamp: new Date(),
    taskType: "chat",
    messages: [{ role: "user", content: "Hello" }],
    requiredCapabilities: ["chat"],
    privacyRequired: false,
    stream: false,
    ...overrides,
  } as RoutingRequest;
}

describe("RouterEngine", () => {
  it("routes to the only available provider", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o" })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest());
    expect(result.selectedProvider).toBe("openai");
    expect(result.selectedModel).toBe("gpt-4o");
    expect(result.alternatives).toHaveLength(0);
  });

  it("returns alternatives when multiple candidates exist", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o", latencyTtftMs: 600 })],
        }),
        makeProvider({
          name: "anthropic",
          models: [makeModel({ id: "claude-sonnet", latencyTtftMs: 400 })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: true,
      healthAware: false,
    });

    const result = await engine.route(makeRequest());
    expect(result.selectedProvider).toBe("anthropic"); // faster = higher score
    expect(result.alternatives.length).toBeGreaterThan(0);
    expect(result.alternatives[0].provider).toBe("openai");
  });

  it("disqualifies providers missing required capabilities", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o", capabilities: ["chat", "vision"] })],
        }),
        makeProvider({
          name: "ollama",
          models: [makeModel({ id: "llama3", capabilities: ["chat", "streaming"] })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(
      makeRequest({ requiredCapabilities: ["chat", "vision"] })
    );
    expect(result.selectedProvider).toBe("openai"); // ollama disqualified (no vision)
  });

  it("disqualifies models with insufficient context window", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o", contextWindow: 128_000 })],
        }),
        makeProvider({
          name: "ollama",
          models: [makeModel({ id: "tiny", contextWindow: 4_000 })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(
      makeRequest({ messages: [{ role: "user", content: "a".repeat(20_000) }] })
    );
    expect(result.selectedProvider).toBe("openai");
  });

  it("filters by privacy requirement", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o" })],
        }),
        makeProvider({
          name: "ollama",
          models: [makeModel({ id: "llama3" })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest({ privacyRequired: true }));
    expect(result.selectedProvider).toBe("ollama");
  });

  it("filters by max price", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "expensive", promptPricePer1k: 0.1 })],
        }),
        makeProvider({
          name: "ollama",
          models: [makeModel({ id: "free", promptPricePer1k: 0 })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest({ maxPricePer1k: 0.01 }));
    expect(result.selectedProvider).toBe("ollama");
  });

  it("filters by max latency", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "slow", latencyTtftMs: 2000 })],
        }),
        makeProvider({
          name: "anthropic",
          models: [makeModel({ id: "fast", latencyTtftMs: 200 })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest({ maxLatencyMs: 500 }));
    expect(result.selectedProvider).toBe("anthropic");
  });

  it("skips unhealthy providers when healthAware is true", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o" })],
        }),
        makeProvider({
          name: "anthropic",
          models: [makeModel({ id: "claude" })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: true,
    });

    engine.updateHealth([
      {
        provider: "openai",
        status: "unhealthy",
        lastChecked: new Date(),
        latencyMs: 1000,
        errorRate: 1,
        successRate: 0,
        consecutiveFailures: 5,
      },
      {
        provider: "anthropic",
        status: "healthy",
        lastChecked: new Date(),
        latencyMs: 300,
        errorRate: 0,
        successRate: 1,
        consecutiveFailures: 0,
      },
    ]);

    const result = await engine.route(makeRequest());
    expect(result.selectedProvider).toBe("anthropic");
  });

  it("boosts healthy providers and penalizes degraded", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o", latencyTtftMs: 500 })],
        }),
        makeProvider({
          name: "anthropic",
          models: [makeModel({ id: "claude", latencyTtftMs: 500 })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: true,
    });

    engine.updateHealth([
      {
        provider: "openai",
        status: "healthy",
        lastChecked: new Date(),
        latencyMs: 300,
        errorRate: 0,
        successRate: 1,
        consecutiveFailures: 0,
      },
      {
        provider: "anthropic",
        status: "degraded",
        lastChecked: new Date(),
        latencyMs: 2000,
        errorRate: 0.3,
        successRate: 0.7,
        consecutiveFailures: 2,
      },
    ]);

    const result = await engine.route(makeRequest());
    expect(result.selectedProvider).toBe("openai");
  });

  it("penalizes unhealthy providers heavily", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o", latencyTtftMs: 100 })],
        }),
        makeProvider({
          name: "anthropic",
          models: [makeModel({ id: "claude", latencyTtftMs: 100 })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    engine.updateHealth([
      {
        provider: "openai",
        status: "healthy",
        lastChecked: new Date(),
        latencyMs: 300,
        errorRate: 0,
        successRate: 1,
        consecutiveFailures: 0,
      },
      {
        provider: "anthropic",
        status: "unhealthy",
        lastChecked: new Date(),
        latencyMs: 5000,
        errorRate: 1,
        successRate: 0,
        consecutiveFailures: 10,
      },
    ]);

    const result = await engine.route(makeRequest());
    expect(result.selectedProvider).toBe("openai");
  });

  it("estimates tokens with image content", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o" })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest({
      messages: [{ role: "user", content: [{ type: "text", text: "Hi" }, { type: "image", url: "http://img" }] }],
    }));
    expect(result.selectedProvider).toBe("openai");
  });

  it("applies route_to rule", async () => {
    const rule: RoutingRule = {
      id: "r1",
      name: "Force Anthropic",
      priority: 100,
      enabled: true,
      condition: { type: "task_type", taskType: "coding" },
      action: { type: "route_to", provider: "anthropic" },
    };

    const engine = new RouterEngine({
      rules: [rule],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o", latencyTtftMs: 100 })],
        }),
        makeProvider({
          name: "anthropic",
          models: [makeModel({ id: "claude", latencyTtftMs: 1000 })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest({ taskType: "coding" }));
    expect(result.selectedProvider).toBe("anthropic");
    expect(result.appliedRules).toContain("Force Anthropic (forced route)");
  });

  it("applies prefer_local rule", async () => {
    const rule: RoutingRule = {
      id: "r1",
      name: "Privacy",
      priority: 100,
      enabled: true,
      condition: { type: "privacy_required", required: true },
      action: { type: "prefer_local" },
    };

    const engine = new RouterEngine({
      rules: [rule],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o" })],
        }),
        makeProvider({
          name: "ollama",
          models: [makeModel({ id: "llama3" })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest({ privacyRequired: true }));
    expect(result.selectedProvider).toBe("ollama");
  });

  it("applies score_boost rule", async () => {
    const rule: RoutingRule = {
      id: "r1",
      name: "Boost Claude",
      priority: 100,
      enabled: true,
      condition: { type: "task_type", taskType: "coding" },
      action: { type: "score_boost", provider: "anthropic", boost: 30 },
    };

    const engine = new RouterEngine({
      rules: [rule],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o" })],
        }),
        makeProvider({
          name: "anthropic",
          models: [makeModel({ id: "claude" })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest({ taskType: "coding" }));
    expect(result.selectedProvider).toBe("anthropic");
  });

  it("rejects via reject rule", async () => {
    const rule: RoutingRule = {
      id: "r1",
      name: "Block OpenAI",
      priority: 100,
      enabled: true,
      condition: { type: "task_type", taskType: "chat" },
      action: { type: "reject", reason: "OpenAI disabled" },
    };

    const engine = new RouterEngine({
      rules: [rule],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o" })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    await expect(engine.route(makeRequest())).rejects.toThrow(RouterError);
  });

  it("disqualifies via route_to model mismatch", async () => {
    const rule: RoutingRule = {
      id: "r1",
      name: "Force Model",
      priority: 100,
      enabled: true,
      condition: { type: "task_type", taskType: "chat" },
      action: { type: "route_to", provider: "openai", model: "gpt-4o" },
    };

    const engine = new RouterEngine({
      rules: [rule],
      providers: [
        makeProvider({
          name: "openai",
          models: [
            makeModel({ id: "gpt-4o" }),
            makeModel({ id: "gpt-3.5" }),
          ],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest());
    expect(result.selectedModel).toBe("gpt-4o");
  });

  it("evaluates all condition types", async () => {
    const rules: RoutingRule[] = [
      { id: "r1", name: "Cap", priority: 100, enabled: true, condition: { type: "model_capability", capability: "image_generation" }, action: { type: "score_boost", provider: "openai", boost: 1 } },
      { id: "r2", name: "Price", priority: 90, enabled: true, condition: { type: "max_price", pricePer1k: 0.0001 }, action: { type: "score_boost", provider: "openai", boost: 1 } },
      { id: "r3", name: "Latency", priority: 80, enabled: true, condition: { type: "max_latency", latencyMs: 10 }, action: { type: "score_boost", provider: "openai", boost: 1 } },
      { id: "r4", name: "Privacy", priority: 70, enabled: true, condition: { type: "privacy_required", required: true }, action: { type: "score_boost", provider: "openai", boost: 1 } },
      { id: "r5", name: "Provider", priority: 60, enabled: true, condition: { type: "provider", provider: "anthropic" }, action: { type: "score_boost", provider: "openai", boost: 1 } },
      { id: "r6", name: "Context", priority: 50, enabled: true, condition: { type: "context_size", maxTokens: 200000 }, action: { type: "score_boost", provider: "openai", boost: 1 } },
      { id: "r7", name: "Custom", priority: 40, enabled: true, condition: { type: "custom" }, action: { type: "score_boost", provider: "openai", boost: 1 } },
    ];

    const engine = new RouterEngine({
      rules,
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o", capabilities: ["chat", "vision"], promptPricePer1k: 0.001, latencyTtftMs: 50, contextWindow: 128_000 })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest());
    expect(result.selectedProvider).toBe("openai");
  });

  it("handles unknown condition type gracefully", async () => {
    const rule: RoutingRule = {
      id: "r1",
      name: "Unknown",
      priority: 100,
      enabled: true,
      condition: { type: "invalid" } as any,
      action: { type: "score_boost", provider: "openai", boost: 1 },
    };

    const engine = new RouterEngine({
      rules: [rule],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o" })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest());
    expect(result.selectedProvider).toBe("openai");
  });

  it("applies local-first boost", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o", latencyTtftMs: 100 })],
        }),
        makeProvider({
          name: "ollama",
          models: [makeModel({ id: "llama3", latencyTtftMs: 100 })],
        }),
      ],
      localFirst: true,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest());
    expect(result.selectedProvider).toBe("ollama");
  });

  it("prefers cheaper models", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "expensive", promptPricePer1k: 0.05 })],
        }),
        makeProvider({
          name: "ollama",
          models: [makeModel({ id: "free", promptPricePer1k: 0 })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest());
    expect(result.selectedProvider).toBe("ollama");
  });

  it("prefers lower latency models", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "slow", latencyTtftMs: 2000 })],
        }),
        makeProvider({
          name: "anthropic",
          models: [makeModel({ id: "fast", latencyTtftMs: 200 })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest());
    expect(result.selectedProvider).toBe("anthropic");
  });

  it("applies weight boost", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          weight: 1,
          models: [makeModel({ id: "gpt-4o" })],
        }),
        makeProvider({
          name: "anthropic",
          weight: 10,
          models: [makeModel({ id: "claude" })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest());
    expect(result.selectedProvider).toBe("anthropic");
  });

  it("throws RouterError when no providers available", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    await expect(engine.route(makeRequest())).rejects.toThrow(RouterError);
  });

  it("throws RouterError when all candidates disqualified", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o", capabilities: ["chat"] })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    await expect(
      engine.route(makeRequest({ requiredCapabilities: ["vision"] }))
    ).rejects.toThrow(RouterError);
  });

  it("includes routeReason with all contributing factors", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o" })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest());
    expect(result.routeReason).toContain("capability match");
    expect(result.routeReason).toContain("cost score");
    expect(result.routeReason).toContain("latency score");
  });

  it("estimates cost and latency in result", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o", promptPricePer1k: 0.002, completionPricePer1k: 0.01 })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest({ estimatedTokens: 1000 }));
    expect(result.estimatedCost).toBeGreaterThan(0);
    expect(result.estimatedLatencyMs).toBeGreaterThan(0);
  });

  it("handles streaming capability request", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o", capabilities: ["chat", "streaming"] })],
        }),
        makeProvider({
          name: "ollama",
          models: [makeModel({ id: "llama3", capabilities: ["chat"] })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest({ stream: true, requiredCapabilities: ["chat", "streaming"] }));
    expect(result.selectedProvider).toBe("openai");
  });

  it("routes to explicitly requested model", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4", capabilities: ["code"] })],
        }),
        makeProvider({
          name: "anthropic",
          models: [makeModel({ id: "claude", capabilities: ["chat"] })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest({ model: "gpt-4" }));
    expect(result.selectedProvider).toBe("openai");
    expect(result.selectedModel).toBe("gpt-4");
  });

  it("skips capability filter when explicit model is requested", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4", capabilities: ["code"] })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(
      makeRequest({ model: "gpt-4", requiredCapabilities: ["chat"] })
    );
    expect(result.selectedProvider).toBe("openai");
    expect(result.selectedModel).toBe("gpt-4");
  });

  it("throws RouterError when explicit model does not exist", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o" })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    await expect(
      engine.route(makeRequest({ model: "gpt-5.5-pro" }))
    ).rejects.toThrow(RouterError);
  });

  it("applies capability filter when model is auto", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          models: [makeModel({ id: "gpt-4o", capabilities: ["chat"] })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest({ model: "auto" }));
    expect(result.selectedProvider).toBe("openai");
  });

  it("skips disabled providers", async () => {
    const engine = new RouterEngine({
      rules: [],
      providers: [
        makeProvider({
          name: "openai",
          enabled: false,
          models: [makeModel({ id: "gpt-4o" })],
        }),
        makeProvider({
          name: "anthropic",
          enabled: true,
          models: [makeModel({ id: "claude" })],
        }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest());
    expect(result.selectedProvider).toBe("anthropic");
  });

  it("prioritizes rules by priority order", async () => {
    const highPriority: RoutingRule = {
      id: "r1",
      name: "High",
      priority: 200,
      enabled: true,
      condition: { type: "task_type", taskType: "chat" },
      action: { type: "score_boost", provider: "anthropic", boost: 100 },
    };

    const lowPriority: RoutingRule = {
      id: "r2",
      name: "Low",
      priority: 100,
      enabled: true,
      condition: { type: "task_type", taskType: "chat" },
      action: { type: "score_boost", provider: "openai", boost: 10 },
    };

    const engine = new RouterEngine({
      rules: [lowPriority, highPriority],
      providers: [
        makeProvider({ name: "openai", models: [makeModel({ id: "gpt-4o" })] }),
        makeProvider({ name: "anthropic", models: [makeModel({ id: "claude" })] }),
      ],
      localFirst: false,
      budgetAware: false,
      fallbackEnabled: false,
      healthAware: false,
    });

    const result = await engine.route(makeRequest());
    expect(result.selectedProvider).toBe("anthropic");
  });
});

describe("RouterError", () => {
  it("has correct name and message", () => {
    const err = new RouterError("Something failed");
    expect(err.name).toBe("RouterError");
    expect(err.message).toBe("Something failed");
  });
});
