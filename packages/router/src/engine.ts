import type {
  ProviderConfig,
  ProviderHealth,
  ProviderName,
  RoutingRequest,
  RoutingResult,
  RoutingRule,
  AlternativeRoute,
  ModelInfo,
  ModelCapability,
} from "@modelmesh/shared";

export interface RouterEngineOptions {
  rules: RoutingRule[];
  providers: ProviderConfig[];
  defaultProvider?: ProviderName;
  localFirst: boolean;
  budgetAware: boolean;
  fallbackEnabled: boolean;
  healthAware: boolean;
}

export interface ScoredProvider {
  config: ProviderConfig;
  model: ModelInfo;
  score: number;
  cost: number;
  latencyMs: number;
  reasons: string[];
  disqualified: boolean;
  disqualifyReason?: string;
}

const CAPABILITY_WEIGHTS: Record<ModelCapability, number> = {
  chat: 1,
  completion: 1,
  embeddings: 1,
  image_generation: 1.5,
  vision: 1.5,
  function_calling: 1.3,
  tool_use: 1.3,
  reasoning: 1.4,
  code: 1.3,
  multimodal: 1.6,
  streaming: 1,
  json_mode: 1.1,
};

export class RouterEngine {
  private options: RouterEngineOptions;
  private healthState = new Map<ProviderName, ProviderHealth>();

  constructor(options: RouterEngineOptions) {
    this.options = options;
  }

  updateHealth(health: ProviderHealth[]) {
    for (const h of health) {
      this.healthState.set(h.provider, h);
    }
  }

  async route(request: RoutingRequest): Promise<RoutingResult> {
    const candidates = this.gatherCandidates(request);
    const scored = this.scoreCandidates(candidates, request);
    const valid = scored.filter((s) => !s.disqualified);

    if (valid.length === 0) {
      const bestDisqualified = scored
        .filter((s) => s.disqualified)
        .sort((a, b) => b.score - a.score)[0];
      throw new RouterError(
        `No provider available. ${bestDisqualified?.disqualifyReason ?? "All providers disqualified."}`
      );
    }

    valid.sort((a, b) => b.score - a.score);
    const winner = valid[0];

    const alternatives: AlternativeRoute[] = valid.slice(1, 4).map((v) => ({
      provider: v.config.name,
      model: v.model.id,
      score: Number(v.score.toFixed(3)),
      estimatedCost: Number(v.cost.toFixed(6)),
    }));

    return {
      requestId: request.id,
      selectedProvider: winner.config.name,
      selectedModel: winner.model.id,
      routeReason: winner.reasons.join("; "),
      score: Number(winner.score.toFixed(3)),
      estimatedCost: Number(winner.cost.toFixed(6)),
      estimatedLatencyMs: Math.round(winner.latencyMs),
      alternatives,
      appliedRules: winner.reasons.filter((r) => r.startsWith("rule:")).map((r) => r.replace("rule:", "")),
    };
  }

  private gatherCandidates(_request: RoutingRequest): ScoredProvider[] {
    const candidates: ScoredProvider[] = [];
    for (const provider of this.options.providers) {
      if (!provider.enabled) continue;

      const health = this.healthState.get(provider.name);
      if (this.options.healthAware && health?.status === "unhealthy") continue;

      for (const model of provider.models) {
        candidates.push({
          config: provider,
          model,
          score: 0,
          cost: 0,
          latencyMs: model.latencyProfile.ttftMs,
          reasons: [],
          disqualified: false,
        });
      }
    }
    return candidates;
  }

  private scoreCandidates(candidates: ScoredProvider[], request: RoutingRequest): ScoredProvider[] {
    const explicitModel = request.model && request.model !== "auto" ? request.model : null;

    for (const candidate of candidates) {
      if (explicitModel && candidate.model.id !== explicitModel) {
        candidate.disqualified = true;
        candidate.disqualifyReason = `Model mismatch: requested ${explicitModel}`;
        continue;
      }

      if (!explicitModel) {
        this.applyCapabilityFilter(candidate, request.requiredCapabilities);
        if (candidate.disqualified) continue;
      }

      this.applyContextWindowFilter(candidate, request);
      if (candidate.disqualified) continue;

      this.applyPrivacyFilter(candidate, request);
      if (candidate.disqualified) continue;

      this.applyPriceFilter(candidate, request);
      if (candidate.disqualified) continue;

      this.applyLatencyFilter(candidate, request);
      if (candidate.disqualified) continue;

      this.applyRules(candidate, request);
      this.applyLocalFirstBoost(candidate);
      this.applyHealthBoost(candidate);
      this.applyCapabilityMatchScore(candidate, request);
      this.applyCostScore(candidate, request);
      this.applyLatencyScore(candidate);
      this.applyWeightBoost(candidate);
    }
    return candidates;
  }

  private applyCapabilityFilter(candidate: ScoredProvider, required: ModelCapability[]) {
    const missing = required.filter((c) => !candidate.model.capabilities.includes(c));
    if (missing.length > 0) {
      candidate.disqualified = true;
      candidate.disqualifyReason = `Missing capabilities: ${missing.join(", ")}`;
    }
  }

  private applyContextWindowFilter(candidate: ScoredProvider, request: RoutingRequest) {
    const needed = request.estimatedTokens ?? this.estimateTokens(request);
    if (needed > candidate.model.contextWindow) {
      candidate.disqualified = true;
      candidate.disqualifyReason = `Context window too small (${candidate.model.contextWindow} < ${needed})`;
    }
  }

  private applyPrivacyFilter(candidate: ScoredProvider, request: RoutingRequest) {
    if (!request.privacyRequired) return;
    const localProviders: ProviderName[] = ["ollama", "lmstudio", "localai", "vllm"];
    if (!localProviders.includes(candidate.config.name)) {
      candidate.disqualified = true;
      candidate.disqualifyReason = "Privacy requires local provider";
    }
  }

  private applyPriceFilter(candidate: ScoredProvider, request: RoutingRequest) {
    if (request.maxPricePer1k == null) return;
    const effectivePrice = Math.max(
      candidate.model.pricing.promptPer1k,
      candidate.model.pricing.completionPer1k
    );
    if (effectivePrice > request.maxPricePer1k) {
      candidate.disqualified = true;
      candidate.disqualifyReason = `Price too high (${effectivePrice} > ${request.maxPricePer1k})`;
    }
  }

  private applyLatencyFilter(candidate: ScoredProvider, request: RoutingRequest) {
    if (request.maxLatencyMs == null) return;
    if (candidate.model.latencyProfile.ttftMs > request.maxLatencyMs) {
      candidate.disqualified = true;
      candidate.disqualifyReason = `Latency too high (${candidate.model.latencyProfile.ttftMs}ms > ${request.maxLatencyMs}ms)`;
    }
  }

  private applyRules(candidate: ScoredProvider, request: RoutingRequest) {
    const sortedRules = [...this.options.rules].filter((r) => r.enabled).sort((a, b) => b.priority - a.priority);
    for (const rule of sortedRules) {
      const matches = this.evaluateCondition(rule.condition, candidate, request);
      if (!matches) continue;

      switch (rule.action.type) {
        case "route_to":
          if (rule.action.provider === candidate.config.name) {
            candidate.score += 50;
            candidate.reasons.push(`rule:${rule.name} (forced route)`);
            if (rule.action.model && rule.action.model !== candidate.model.id) {
              candidate.disqualified = true;
              candidate.disqualifyReason = `Rule ${rule.name} requires model ${rule.action.model}`;
            }
          } else {
            candidate.score -= 30;
          }
          break;
        case "prefer_local": {
          const localProviders: ProviderName[] = ["ollama", "lmstudio", "localai", "vllm"];
          if (localProviders.includes(candidate.config.name)) {
            candidate.score += 40;
            candidate.reasons.push(`rule:${rule.name} (local boost)`);
          }
          break;
        }
        case "score_boost":
          if (rule.action.provider === candidate.config.name) {
            candidate.score += rule.action.boost;
            candidate.reasons.push(`rule:${rule.name} (+${rule.action.boost})`);
          }
          break;
        case "reject":
          candidate.disqualified = true;
          candidate.disqualifyReason = `Rejected by rule: ${rule.name} - ${rule.action.reason}`;
          break;
      }
    }
  }

  private evaluateCondition(
    condition: RoutingRule["condition"],
    candidate: ScoredProvider,
    request: RoutingRequest
  ): boolean {
    switch (condition.type) {
      case "task_type":
        return request.taskType === condition.taskType;
      case "model_capability":
        return candidate.model.capabilities.includes(condition.capability);
      case "max_price":
        return candidate.model.pricing.promptPer1k <= condition.pricePer1k;
      case "max_latency":
        return candidate.model.latencyProfile.ttftMs <= condition.latencyMs;
      case "privacy_required":
        return request.privacyRequired === condition.required;
      case "provider":
        return candidate.config.name === condition.provider;
      case "context_size":
        return candidate.model.contextWindow >= condition.maxTokens;
      case "custom":
        return false;
      default:
        return false;
    }
  }

  private applyLocalFirstBoost(candidate: ScoredProvider) {
    if (!this.options.localFirst) return;
    const localProviders: ProviderName[] = ["ollama", "lmstudio", "localai", "vllm"];
    if (localProviders.includes(candidate.config.name)) {
      candidate.score += 25;
      candidate.reasons.push("local-first boost");
    }
  }

  private applyHealthBoost(candidate: ScoredProvider) {
    const health = this.healthState.get(candidate.config.name);
    if (!health) return;
    switch (health.status) {
      case "healthy":
        candidate.score += 10;
        candidate.reasons.push("provider healthy");
        break;
      case "degraded":
        candidate.score -= 20;
        candidate.reasons.push("provider degraded");
        break;
      case "unhealthy":
        candidate.score -= 100;
        candidate.reasons.push("provider unhealthy");
        break;
    }
  }

  private applyCapabilityMatchScore(candidate: ScoredProvider, request: RoutingRequest) {
    const matched = request.requiredCapabilities.filter((c) => candidate.model.capabilities.includes(c));
    const weight = matched.reduce((sum, c) => sum + (CAPABILITY_WEIGHTS[c] ?? 1), 0);
    candidate.score += weight * 5;
    candidate.reasons.push(`capability match ${matched.length}/${request.requiredCapabilities.length}`);
  }

  private applyCostScore(candidate: ScoredProvider, request: RoutingRequest) {
    const promptTokens = request.estimatedTokens ?? this.estimateTokens(request);
    const completionTokens = Math.min(promptTokens, candidate.model.maxTokens ?? 4096);
    const cost =
      (promptTokens / 1000) * candidate.model.pricing.promptPer1k +
      (completionTokens / 1000) * candidate.model.pricing.completionPer1k;
    candidate.cost = cost;
    const costScore = Math.max(0, 20 - cost * 1000);
    candidate.score += costScore;
    candidate.reasons.push(`cost score ${costScore.toFixed(2)}`);
  }

  private applyLatencyScore(candidate: ScoredProvider) {
    const latency = candidate.model.latencyProfile.ttftMs;
    const latencyScore = Math.max(0, 15 - latency / 200);
    candidate.score += latencyScore;
    candidate.reasons.push(`latency score ${latencyScore.toFixed(2)}`);
  }

  private applyWeightBoost(candidate: ScoredProvider) {
    candidate.score += candidate.config.weight * 2;
    candidate.reasons.push(`weight ${candidate.config.weight}`);
  }

  private estimateTokens(request: RoutingRequest): number {
    let chars = 0;
    for (const msg of request.messages) {
      if (typeof msg.content === "string") {
        chars += msg.content.length;
      } else {
        for (const part of msg.content) {
          if (part.type === "text") chars += part.text.length;
          else chars += 500;
        }
      }
    }
    return Math.ceil(chars / 4) + 256;
  }
}

export class RouterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RouterError";
  }
}