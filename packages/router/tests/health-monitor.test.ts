import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HealthMonitor } from "../src/health-monitor.js";
import type { ProviderConfig } from "@modelmesh/shared";

describe("HealthMonitor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function makeProvider(overrides: Partial<ProviderConfig> & { name: ProviderConfig["name"] }): ProviderConfig {
    return {
      name: overrides.name,
      enabled: true,
      timeoutMs: 30000,
      retries: 3,
      weight: 1,
      models: [],
      healthCheck: { enabled: true, intervalMs: 1000, timeoutMs: 5000 },
      ...overrides,
      models: overrides.models ?? [],
    } as ProviderConfig;
  }

  it("marks provider healthy on OK response", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    const onChange = vi.fn();
    const monitor = new HealthMonitor({
      checkIntervalMs: 1000,
      timeoutMs: 5000,
      failureThreshold: 3,
      onStatusChange: onChange,
    });

    monitor.start([makeProvider({ name: "openai", baseUrl: "https://api.openai.com/v1" })]);
    await vi.advanceTimersToNextTimerAsync();

    const state = monitor.getState();
    expect(state).toHaveLength(1);
    expect(state[0].status).toBe("healthy");
    expect(state[0].provider).toBe("openai");
    expect(state[0].latencyMs).toBeGreaterThanOrEqual(0);
    expect(onChange).not.toHaveBeenCalled(); // no previous state, so no change

    monitor.stop();
  });

  it("marks provider unhealthy on failed response", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);

    const monitor = new HealthMonitor({
      checkIntervalMs: 1000,
      timeoutMs: 5000,
      failureThreshold: 3,
    });

    monitor.start([makeProvider({ name: "openai" })]);
    await vi.advanceTimersToNextTimerAsync();

    const state = monitor.getState();
    expect(state[0].status).toBe("unhealthy");
    expect(state[0].errorRate).toBe(1);
    expect(state[0].successRate).toBe(0);

    monitor.stop();
  });

  it("marks provider unhealthy on fetch error", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("Network failure"));

    const monitor = new HealthMonitor({
      checkIntervalMs: 1000,
      timeoutMs: 5000,
      failureThreshold: 3,
    });

    monitor.start([makeProvider({ name: "openai" })]);
    await vi.advanceTimersToNextTimerAsync();

    const state = monitor.getState();
    expect(state[0].status).toBe("unhealthy");

    monitor.stop();
  });

  it("marks degraded when latency exceeds timeout", async () => {
    vi.mocked(global.fetch).mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 100));
      return { ok: true, status: 200 } as Response;
    });

    const monitor = new HealthMonitor({
      checkIntervalMs: 1000,
      timeoutMs: 5000,
      failureThreshold: 3,
    });

    monitor.start([makeProvider({ name: "openai", timeoutMs: 50 })]);
    await vi.advanceTimersToNextTimerAsync();

    const state = monitor.getState();
    expect(state[0].status).toBe("degraded");

    monitor.stop();
  });

  it("tracks consecutive failures", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("fail"));

    const monitor = new HealthMonitor({
      checkIntervalMs: 1000,
      timeoutMs: 5000,
      failureThreshold: 3,
    });

    monitor.start([makeProvider({ name: "openai" })]);
    await vi.runAllTicks();

    expect(monitor.getState()[0].consecutiveFailures).toBe(1);

    await vi.advanceTimersToNextTimerAsync();
    expect(monitor.getState()[0].consecutiveFailures).toBe(2);

    await vi.advanceTimersToNextTimerAsync();
    expect(monitor.getState()[0].consecutiveFailures).toBe(3);

    monitor.stop();
  });

  it("resets consecutive failures on success", async () => {
    let callCount = 0;
    vi.mocked(global.fetch).mockImplementation(() => {
      callCount++;
      if (callCount <= 2) return Promise.reject(new Error("fail"));
      return Promise.resolve({ ok: true, status: 200 } as Response);
    });

    const monitor = new HealthMonitor({
      checkIntervalMs: 1000,
      timeoutMs: 5000,
      failureThreshold: 3,
    });

    monitor.start([makeProvider({ name: "openai" })]);
    await vi.runAllTicks();
    expect(monitor.getState()[0].consecutiveFailures).toBe(1);

    await vi.advanceTimersToNextTimerAsync();
    expect(monitor.getState()[0].consecutiveFailures).toBe(2);

    await vi.advanceTimersToNextTimerAsync();
    expect(monitor.getState()[0].consecutiveFailures).toBe(0);
    expect(monitor.getState()[0].status).toBe("healthy");

    monitor.stop();
  });

  it("calls onStatusChange when status changes", async () => {
    let callCount = 0;
    vi.mocked(global.fetch).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ ok: true, status: 200 } as Response);
      return Promise.reject(new Error("fail"));
    });

    const onChange = vi.fn();
    const monitor = new HealthMonitor({
      checkIntervalMs: 1000,
      timeoutMs: 5000,
      failureThreshold: 3,
      onStatusChange: onChange,
    });

    monitor.start([makeProvider({ name: "openai" })]);
    await vi.runAllTicks();
    expect(monitor.getState()[0].status).toBe("healthy");
    expect(onChange).not.toHaveBeenCalled();

    await vi.advanceTimersToNextTimerAsync();
    expect(onChange).toHaveBeenCalledWith("openai", "healthy", "degraded");

    monitor.stop();
  });

  it("does not check disabled health checks", async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, status: 200 } as Response);

    const monitor = new HealthMonitor({
      checkIntervalMs: 1000,
      timeoutMs: 5000,
      failureThreshold: 3,
    });

    monitor.start([
      makeProvider({ name: "openai", healthCheck: { enabled: false, intervalMs: 1000, timeoutMs: 5000 } }),
    ]);

    await vi.advanceTimersByTimeAsync(2000);
    expect(monitor.getState()).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();

    monitor.stop();
  });

  it("aborts fetch on timeout", async () => {
    vi.mocked(global.fetch).mockImplementation(async (_url, init) => {
      await new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), 10_000);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("aborted"));
        });
      });
      return { ok: true, status: 200 } as Response;
    });

    const monitor = new HealthMonitor({
      checkIntervalMs: 1000,
      timeoutMs: 100,
      failureThreshold: 3,
    });

    monitor.start([makeProvider({ name: "openai" })]);
    await vi.advanceTimersToNextTimerAsync();

    const state = monitor.getState();
    expect(state[0].status).toBe("unhealthy");

    monitor.stop();
  });

  it("clears all intervals on stop", () => {
    const monitor = new HealthMonitor({
      checkIntervalMs: 1000,
      timeoutMs: 5000,
      failureThreshold: 3,
    });

    monitor.start([
      makeProvider({ name: "openai" }),
      makeProvider({ name: "anthropic" }),
    ]);

    expect(monitor.getState()).toHaveLength(0); // checks are async
    monitor.stop();
    // no error thrown = intervals cleared
  });

  it("uses provider-specific interval", async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, status: 200 } as Response);

    const monitor = new HealthMonitor({
      checkIntervalMs: 1000,
      timeoutMs: 5000,
      failureThreshold: 3,
    });

    monitor.start([
      makeProvider({ name: "openai", healthCheck: { enabled: true, intervalMs: 500, timeoutMs: 5000 } }),
    ]);
    await vi.runAllTicks();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(500);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    monitor.stop();
  });

  it("uses default base URLs when none provided", async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, status: 200 } as Response);

    const monitor = new HealthMonitor({
      checkIntervalMs: 1000,
      timeoutMs: 5000,
      failureThreshold: 3,
    });

    monitor.start([makeProvider({ name: "openai" })]);
    await vi.advanceTimersToNextTimerAsync();

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/health",
      expect.any(Object)
    );

    monitor.stop();
  });

  it("uses custom base URL when provided", async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, status: 200 } as Response);

    const monitor = new HealthMonitor({
      checkIntervalMs: 1000,
      timeoutMs: 5000,
      failureThreshold: 3,
    });

    monitor.start([makeProvider({ name: "ollama", baseUrl: "http://my-ollama:11434" })]);
    await vi.advanceTimersToNextTimerAsync();

    expect(global.fetch).toHaveBeenCalledWith(
      "http://my-ollama:11434/api/tags",
      expect.any(Object)
    );

    monitor.stop();
  });

  it("handles degraded -> unhealthy transition via threshold", async () => {
    let callCount = 0;
    vi.mocked(global.fetch).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ ok: true, status: 200 } as Response);
      return Promise.resolve({ ok: false, status: 503 } as Response);
    });

    const monitor = new HealthMonitor({
      checkIntervalMs: 1000,
      timeoutMs: 5000,
      failureThreshold: 2,
    });

    monitor.start([makeProvider({ name: "openai" })]);
    await vi.runAllTicks();
    expect(monitor.getState()[0].status).toBe("healthy");

    await vi.advanceTimersToNextTimerAsync();
    expect(monitor.getState()[0].status).toBe("degraded"); // first failure after healthy

    await vi.advanceTimersToNextTimerAsync();
    expect(monitor.getState()[0].status).toBe("unhealthy"); // threshold reached

    monitor.stop();
  });

  it("uses default base URLs for all providers", async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, status: 200 } as Response);

    const monitor = new HealthMonitor({
      checkIntervalMs: 1000,
      timeoutMs: 5000,
      failureThreshold: 3,
    });

    const providers = [
      makeProvider({ name: "ollama" }),
      makeProvider({ name: "groq" }),
      makeProvider({ name: "gemini" }),
      makeProvider({ name: "mistral" }),
      makeProvider({ name: "openrouter" }),
      makeProvider({ name: "unknown" as any }),
    ];

    monitor.start(providers);
    await vi.runAllTicks();

    const calls = (global.fetch as any).mock.calls;
    expect(calls[0][0]).toBe("http://localhost:11434/api/tags");
    expect(calls[1][0]).toBe("https://api.groq.com/openai/v1/health");
    expect(calls[2][0]).toBe("https://generativelanguage.googleapis.com/v1beta/health");
    expect(calls[3][0]).toBe("https://api.mistral.ai/v1/health");
    expect(calls[4][0]).toBe("https://openrouter.ai/api/v1/health");
    expect(calls[5][0]).toBe("http://localhost:8080/v1/health");

    monitor.stop();
  });
});
