import type { ProviderConfig, ProviderHealth, ProviderName } from "@modelmesh/shared";

export interface HealthMonitorOptions {
  checkIntervalMs: number;
  timeoutMs: number;
  failureThreshold: number;
  onStatusChange?: (provider: ProviderName, previous: ProviderHealth["status"], current: ProviderHealth["status"]) => void;
}

export class HealthMonitor {
  private state = new Map<ProviderName, ProviderHealth>();
  private intervals = new Map<ProviderName, ReturnType<typeof setInterval>>();
  private options: HealthMonitorOptions;

  constructor(options: HealthMonitorOptions) {
    this.options = options;
  }

  start(providers: ProviderConfig[]) {
    for (const provider of providers) {
      if (!provider.healthCheck.enabled) continue;
      this.checkProvider(provider);
      const interval = setInterval(() => {
        this.checkProvider(provider);
      }, provider.healthCheck.intervalMs ?? this.options.checkIntervalMs);
      this.intervals.set(provider.name, interval);
    }
  }

  stop() {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }

  getState(): ProviderHealth[] {
    return Array.from(this.state.values());
  }

  private async checkProvider(provider: ProviderConfig) {
    const start = Date.now();
    let status: ProviderHealth["status"] = "unknown";
    let errorRate = 0;
    let latencyMs = 0;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

      const baseUrl = provider.baseUrl ?? this.defaultBaseUrl(provider.name);
      const response = await fetch(`${baseUrl}/health`, {
        method: "GET",
        headers: { ...provider.defaultHeaders, "Accept": "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      latencyMs = Date.now() - start;

      if (response.ok) {
        status = latencyMs < provider.timeoutMs ? "healthy" : "degraded";
      } else {
        status = "unhealthy";
        errorRate = 1;
      }
    } catch {
      status = "unhealthy";
      errorRate = 1;
      latencyMs = Date.now() - start;
    }

    const previous = this.state.get(provider.name);
    const consecutiveFailures = status === "unhealthy" ? (previous?.consecutiveFailures ?? 0) + 1 : 0;
    if (consecutiveFailures >= this.options.failureThreshold) {
      status = "unhealthy";
    } else if (status === "unhealthy" && previous?.status === "healthy") {
      status = "degraded";
    }

    const health: ProviderHealth = {
      provider: provider.name,
      status,
      lastChecked: new Date(),
      latencyMs,
      errorRate,
      successRate: 1 - errorRate,
      consecutiveFailures,
    };

    this.state.set(provider.name, health);

    if (previous && previous.status !== status) {
      this.options.onStatusChange?.(provider.name, previous.status, status);
    }
  }

  private defaultBaseUrl(provider: ProviderName): string {
    switch (provider) {
      case "openai":
        return "https://api.openai.com/v1";
      case "anthropic":
        return "https://api.anthropic.com/v1";
      case "ollama":
        return "http://localhost:11434";
      case "groq":
        return "https://api.groq.com/openai/v1";
      case "gemini":
        return "https://generativelanguage.googleapis.com/v1beta";
      case "mistral":
        return "https://api.mistral.ai/v1";
      case "openrouter":
        return "https://openrouter.ai/api/v1";
      default:
        return "http://localhost:8080/v1";
    }
  }
}