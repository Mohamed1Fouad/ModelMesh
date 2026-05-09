import { describe, it, expect } from "vitest";
import { streamTransformer } from "../src/stream-transformer.js";
import type { StreamingChunk } from "@modelmesh/shared";

async function collect(source: AsyncIterable<StreamingChunk>) {
  const chunks: StreamingChunk[] = [];
  for await (const chunk of source) {
    chunks.push(chunk);
  }
  return chunks;
}

describe("streamTransformer", () => {
  it("normalizes OpenAI-format chunks", async () => {
    async function* source() {
      yield { id: "chatcmpl-1", created: 1710000000, choices: [{ index: 0, delta: { content: "Hi" }, finish_reason: null }] };
      yield { id: "chatcmpl-1", created: 1710000000, choices: [{ index: 0, delta: { content: " there" }, finish_reason: "stop" }] };
    }

    const chunks = await collect(streamTransformer(source(), "gpt-4o", "req-1"));
    expect(chunks).toHaveLength(2);
    expect(chunks[0].object).toBe("chat.completion.chunk");
    expect(chunks[0].choices[0].delta.content).toBe("Hi");
    expect(chunks[1].choices[0].finish_reason).toBe("stop");
  });

  it("normalizes Anthropic content_block_delta chunks", async () => {
    async function* source() {
      yield { type: "content_block_delta", delta: { text: "Hello" } };
      yield { type: "content_block_delta", delta: { text: " world" } };
    }

    const chunks = await collect(streamTransformer(source(), "claude-3", "req-2"));
    expect(chunks).toHaveLength(2);
    expect(chunks[0].choices[0].delta.content).toBe("Hello");
    expect(chunks[0].id).toBe("mm-req-2");
    expect(chunks[1].choices[0].delta.content).toBe(" world");
  });

  it("normalizes Ollama message chunks", async () => {
    async function* source() {
      yield { message: { content: "He" }, done: false };
      yield { message: { content: "llo" }, done: true };
    }

    const chunks = await collect(streamTransformer(source(), "llama3", "req-3"));
    expect(chunks).toHaveLength(2);
    expect(chunks[0].choices[0].delta.content).toBe("He");
    expect(chunks[0].choices[0].finish_reason).toBeNull();
    expect(chunks[1].choices[0].delta.content).toBe("llo");
    expect(chunks[1].choices[0].finish_reason).toBe("stop");
  });

  it("normalizes generic content/text chunks", async () => {
    async function* source() {
      yield { content: "A" };
      yield { text: "B", done: true };
    }

    const chunks = await collect(streamTransformer(source(), "custom", "req-4"));
    expect(chunks).toHaveLength(2);
    expect(chunks[0].choices[0].delta.content).toBe("A");
    expect(chunks[1].choices[0].delta.content).toBe("B");
    expect(chunks[1].choices[0].finish_reason).toBe("stop");
  });

  it("skips null and non-object chunks", async () => {
    async function* source() {
      yield null;
      yield "string";
      yield 123;
      yield { content: "valid" };
    }

    const chunks = await collect(streamTransformer(source(), "model", "req-5"));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].choices[0].delta.content).toBe("valid");
  });

  it("emits usage chunk at the end when present", async () => {
    async function* source() {
      yield { id: "1", choices: [{ index: 0, delta: { content: "Done" }, finish_reason: "stop" }], usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 } };
    }

    const chunks = await collect(streamTransformer(source(), "model", "req-6"));
    expect(chunks).toHaveLength(2);
    expect(chunks[0].choices).toHaveLength(1);
    expect(chunks[1].choices).toHaveLength(0);
    expect(chunks[1].usage).toEqual({ prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 });
  });

  it("defaults missing fields", async () => {
    async function* source() {
      yield { choices: [{ index: 0, delta: { content: "" } }] };
    }

    const chunks = await collect(streamTransformer(source(), "model", "req-7"));
    expect(chunks[0].id).toBe("mm-req-7");
    expect(chunks[0].created).toBeGreaterThan(0);
    expect(chunks[0].model).toBe("model");
  });

  it("handles Anthropic delta without text", async () => {
    async function* source() {
      yield { type: "content_block_delta", delta: {} };
    }

    const chunks = await collect(streamTransformer(source(), "claude-3", "req-8"));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].choices[0].delta.content).toBe("");
  });

  it("tracks usage from Ollama message chunks", async () => {
    async function* source() {
      yield { message: { content: "Hi" }, done: false, usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
    }

    const chunks = await collect(streamTransformer(source(), "llama3", "req-9"));
    expect(chunks).toHaveLength(2);
    expect(chunks[1].usage).toEqual({ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 });
  });

  it("yields done for generic chunk without content", async () => {
    async function* source() {
      yield { done: true };
    }

    const chunks = await collect(streamTransformer(source(), "custom", "req-10"));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].choices[0].finish_reason).toBe("stop");
    expect(chunks[0].choices[0].delta.content).toBe("");
  });
});
