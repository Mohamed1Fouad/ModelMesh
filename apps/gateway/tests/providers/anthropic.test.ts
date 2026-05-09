import { describe, it, expect, vi } from "vitest";
import { AnthropicAdapter } from "../../src/providers/anthropic.js";
import type { ProviderConfig } from "@modelmesh/shared";

function makeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    name: "anthropic",
    enabled: true,
    apiKey: "sk-ant-test",
    timeoutMs: 30000,
    retries: 3,
    weight: 1,
    models: [],
    healthCheck: { enabled: true, intervalMs: 30000, timeoutMs: 30000 },
    ...overrides,
    models: overrides.models ?? [],
  };
}

describe("AnthropicAdapter", () => {
  const adapter = new AnthropicAdapter();

  it("converts messages to Anthropic format and back", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "msg_1",
        type: "message",
        role: "assistant",
        model: "claude-3-5-sonnet",
        content: [{ type: "text", text: "Hello there" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 8, output_tokens: 2 },
      }),
    } as Response);

    const result = await adapter.chatCompletion(
      {
        messages: [
          { role: "system", content: "You are helpful" },
          { role: "user", content: "Hi" },
        ],
        model: "auto",
      },
      makeConfig(),
      "claude-3-5-sonnet"
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-api-key": "sk-ant-test",
          "anthropic-version": "2023-06-01",
        }),
      })
    );

    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body.system).toBe("You are helpful");
    expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
    expect(body.model).toBe("claude-3-5-sonnet");

    expect(result.id).toBe("msg_1");
    expect(result.choices[0].message.content).toBe("Hello there");
    expect(result.usage?.prompt_tokens).toBe(8);
    expect(result.usage?.completion_tokens).toBe(2);
  });

  it("handles messages with array content", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "msg_1",
        content: [{ type: "text", text: "OK" }],
        usage: { input_tokens: 5, output_tokens: 1 },
      }),
    } as Response);

    await adapter.chatCompletion(
      {
        messages: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        model: "auto",
      },
      makeConfig(),
      "claude"
    );

    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body.messages[0].content).toBe('[{"type":"text","text":"Hello"}]');
  });

  it("converts tools to Anthropic format", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "msg_1",
        content: [{ type: "text", text: "" }],
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    } as Response);

    await adapter.chatCompletion(
      {
        messages: [{ role: "user", content: "Search" }],
        model: "auto",
        tools: [
          {
            type: "function",
            function: {
              name: "web_search",
              description: "Search the web",
              parameters: { type: "object", properties: { query: { type: "string" } } },
            },
          },
        ],
      },
      makeConfig(),
      "claude"
    );

    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body.tools).toEqual([
      {
        name: "web_search",
        description: "Search the web",
        input_schema: { type: "object", properties: { query: { type: "string" } } },
      },
    ]);
  });

  it("throws on error response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Bad request",
    } as Response);

    await expect(
      adapter.chatCompletion(
        { messages: [{ role: "user", content: "Hi" }], model: "auto" },
        makeConfig(),
        "claude"
      )
    ).rejects.toThrow("Anthropic error 400: Bad request");
  });

  it("returns SSE stream on streaming request", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":{"text":"Hi"}}\n\n'));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    } as Response);

    const iterable = await adapter.chatCompletionStream(
      { messages: [{ role: "user", content: "Hello" }], model: "auto" },
      makeConfig(),
      "claude"
    );

    const chunks: unknown[] = [];
    for await (const chunk of iterable) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect((chunks[0] as any).type).toBe("content_block_delta");
  });

  it("uses custom baseUrl when provided", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "1",
        content: [{ type: "text", text: "" }],
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    } as Response);

    await adapter.chatCompletion(
      { messages: [{ role: "user", content: "Hi" }], model: "auto" },
      makeConfig({ baseUrl: "https://custom.anthropic.com/v1" }),
      "claude"
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://custom.anthropic.com/v1/messages",
      expect.any(Object)
    );
  });

  it("throws on stream error response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "Service unavailable",
    } as Response);

    await expect(
      adapter.chatCompletionStream(
        { messages: [{ role: "user", content: "Hi" }], model: "auto" },
        makeConfig(),
        "claude"
      )
    ).rejects.toThrow("Anthropic stream error 503: Service unavailable");
  });

  it("handles missing usage in response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "msg_1",
        content: [{ type: "text", text: "Hello" }],
      }),
    } as Response);

    const result = await adapter.chatCompletion(
      { messages: [{ role: "user", content: "Hi" }], model: "auto" },
      makeConfig(),
      "claude"
    );

    expect(result.usage).toBeUndefined();
  });

  it("skips malformed SSE lines", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {invalid json}\n\n'));
        controller.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":{"text":"OK"}}\n\n'));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    } as Response);

    const iterable = await adapter.chatCompletionStream(
      { messages: [{ role: "user", content: "Hello" }], model: "auto" },
      makeConfig(),
      "claude"
    );

    const chunks: unknown[] = [];
    for await (const chunk of iterable) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect((chunks[0] as any).type).toBe("content_block_delta");
  });
});
