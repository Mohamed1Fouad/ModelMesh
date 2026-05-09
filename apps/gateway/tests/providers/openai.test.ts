import { describe, it, expect, vi } from "vitest";
import { OpenAIAdapter } from "../../src/providers/openai.js";
import type { ProviderConfig } from "@modelmesh/shared";

function makeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    name: "openai",
    enabled: true,
    apiKey: "sk-test",
    timeoutMs: 30000,
    retries: 3,
    weight: 1,
    models: [],
    healthCheck: { enabled: true, intervalMs: 30000, timeoutMs: 30000 },
    ...overrides,
    models: overrides.models ?? [],
  };
}

describe("OpenAIAdapter", () => {
  const adapter = new OpenAIAdapter();

  it("sends chat completion request with correct headers and body", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "chatcmpl-1",
        object: "chat.completion",
        created: 1710000000,
        model: "gpt-4o",
        choices: [{ index: 0, message: { role: "assistant", content: "Hi" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response);

    const result = await adapter.chatCompletion(
      { messages: [{ role: "user", content: "Hello" }], model: "auto" },
      makeConfig(),
      "gpt-4o"
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test",
        }),
      })
    );
    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body.model).toBe("gpt-4o");
    expect(body.messages).toEqual([{ role: "user", content: "Hello" }]);

    expect(result.choices[0].message.content).toBe("Hi");
    expect(result.usage?.total_tokens).toBe(15);
  });

  it("uses custom baseUrl when provided", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "1",
        object: "chat.completion",
        created: 1,
        model: "custom",
        choices: [{ index: 0, message: { role: "assistant", content: "" }, finish_reason: "stop" }],
      }),
    } as Response);

    await adapter.chatCompletion(
      { messages: [{ role: "user", content: "Hi" }], model: "auto" },
      makeConfig({ baseUrl: "https://custom.openai.com/v1" }),
      "custom-model"
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://custom.openai.com/v1/chat/completions",
      expect.any(Object)
    );
  });

  it("throws on error response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Rate limit exceeded",
    } as Response);

    await expect(
      adapter.chatCompletion(
        { messages: [{ role: "user", content: "Hi" }], model: "auto" },
        makeConfig(),
        "gpt-4o"
      )
    ).rejects.toThrow("OpenAI error 429: Rate limit exceeded");
  });

  it("returns SSE stream on streaming request", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"id":"1","choices":[{"delta":{"content":"He"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"id":"1","choices":[{"delta":{"content":"llo"}}]}\n\n'));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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
      "gpt-4o"
    );

    const chunks: unknown[] = [];
    for await (const chunk of iterable) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect((chunks[0] as any).choices[0].delta.content).toBe("He");
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
        "gpt-4o"
      )
    ).rejects.toThrow("OpenAI stream error");
  });

  it("overrides model field in returned data", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "1",
        object: "chat.completion",
        created: 1,
        model: "wrong-model",
        choices: [{ index: 0, message: { role: "assistant", content: "" }, finish_reason: "stop" }],
      }),
    } as Response);

    const result = await adapter.chatCompletion(
      { messages: [{ role: "user", content: "Hi" }], model: "auto" },
      makeConfig(),
      "gpt-4o"
    );

    expect(result.model).toBe("gpt-4o");
  });

  it("skips malformed SSE lines in stream", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {invalid json}\n\n'));
        controller.enqueue(encoder.encode('data: {"id":"1","choices":[{"delta":{"content":"OK"}}]}\n\n'));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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
      "gpt-4o"
    );

    const chunks: unknown[] = [];
    for await (const chunk of iterable) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect((chunks[0] as any).choices[0].delta.content).toBe("OK");
  });
});
