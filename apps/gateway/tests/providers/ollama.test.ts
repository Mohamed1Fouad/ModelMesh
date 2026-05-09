import { describe, it, expect, vi } from "vitest";
import { OllamaAdapter } from "../../src/providers/ollama.js";
import type { ProviderConfig } from "@modelmesh/shared";

function makeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    name: "ollama",
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

describe("OllamaAdapter", () => {
  const adapter = new OllamaAdapter();

  it("sends chat request to /api/chat with correct body", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "llama3",
        message: { role: "assistant", content: "Hello from Ollama" },
        prompt_eval_count: 12,
        eval_count: 5,
      }),
    } as Response);

    const result = await adapter.chatCompletion(
      { messages: [{ role: "user", content: "Hi" }], model: "auto", temperature: 0.5, max_tokens: 100 },
      makeConfig(),
      "llama3"
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );

    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body.model).toBe("llama3");
    expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
    expect(body.stream).toBe(false);
    expect(body.options.temperature).toBe(0.5);
    expect(body.options.num_predict).toBe(100);

    expect(result.choices[0].message.content).toBe("Hello from Ollama");
    expect(result.usage?.prompt_tokens).toBe(12);
    expect(result.usage?.completion_tokens).toBe(5);
    expect(result.usage?.total_tokens).toBe(17);
  });

  it("sends Authorization header when apiKey is configured", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "llama3",
        message: { role: "assistant", content: "" },
        prompt_eval_count: 1,
        eval_count: 1,
      }),
    } as Response);

    await adapter.chatCompletion(
      { messages: [{ role: "user", content: "Hi" }], model: "auto" },
      makeConfig({ apiKey: "sk-ollama-cloud" }),
      "llama3"
    );

    const headers = (global.fetch as any).mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer sk-ollama-cloud");
  });

  it("uses custom baseUrl when provided", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "llama3",
        message: { role: "assistant", content: "" },
        prompt_eval_count: 1,
        eval_count: 1,
      }),
    } as Response);

    await adapter.chatCompletion(
      { messages: [{ role: "user", content: "Hi" }], model: "auto" },
      makeConfig({ baseUrl: "http://my-server:11434" }),
      "llama3"
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "http://my-server:11434/api/chat",
      expect.any(Object)
    );
  });

  it("throws on error response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal error",
    } as Response);

    await expect(
      adapter.chatCompletion(
        { messages: [{ role: "user", content: "Hi" }], model: "auto" },
        makeConfig(),
        "llama3"
      )
    ).rejects.toThrow("Ollama error 500: Internal error");
  });

  it("handles array content by stringifying", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "llama3",
        message: { role: "assistant", content: "" },
        prompt_eval_count: 1,
        eval_count: 1,
      }),
    } as Response);

    await adapter.chatCompletion(
      {
        messages: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        model: "auto",
      },
      makeConfig(),
      "llama3"
    );

    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body.messages[0].content).toBe('[{"type":"text","text":"Hello"}]');
  });

  it("returns NDJSON stream on streaming request", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"message":{"content":"He"}}\n'));
        controller.enqueue(encoder.encode('{"message":{"content":"llo"}}\n'));
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    } as Response);

    const iterable = await adapter.chatCompletionStream(
      { messages: [{ role: "user", content: "Hi" }], model: "auto" },
      makeConfig(),
      "llama3"
    );

    const chunks: unknown[] = [];
    for await (const chunk of iterable) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect((chunks[0] as any).message.content).toBe("He");
    expect((chunks[1] as any).message.content).toBe("llo");
  });

  it("throws when stream response has no body", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: null,
      text: async () => "",
    } as Response);

    await expect(
      adapter.chatCompletionStream(
        { messages: [{ role: "user", content: "Hi" }], model: "auto" },
        makeConfig(),
        "llama3"
      )
    ).rejects.toThrow("Ollama stream error");
  });

  it("sends Authorization header on stream when apiKey configured", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"message":{"content":"Hi"}}\n'));
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    } as Response);

    await adapter.chatCompletionStream(
      { messages: [{ role: "user", content: "Hello" }], model: "auto" },
      makeConfig({ apiKey: "sk-remote" }),
      "llama3"
    );

    const headers = (global.fetch as any).mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer sk-remote");
  });

  it("skips malformed NDJSON lines", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{invalid json}\n'));
        controller.enqueue(encoder.encode('{"message":{"content":"OK"}}\n'));
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    } as Response);

    const iterable = await adapter.chatCompletionStream(
      { messages: [{ role: "user", content: "Hi" }], model: "auto" },
      makeConfig(),
      "llama3"
    );

    const chunks: unknown[] = [];
    for await (const chunk of iterable) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect((chunks[0] as any).message.content).toBe("OK");
  });
});
