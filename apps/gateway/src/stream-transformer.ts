import type { StreamingChunk } from "@modelmesh/shared";

export async function* streamTransformer(
  source: AsyncIterable<unknown>,
  model: string,
  requestId: string
): AsyncGenerator<StreamingChunk> {
  let usage: StreamingChunk["usage"] | undefined;

  for await (const chunk of source) {
    if (!chunk || typeof chunk !== "object") continue;

    const obj = chunk as Record<string, unknown>;

    if ("choices" in obj && Array.isArray(obj.choices)) {
      yield {
        id: (obj.id as string) ?? `mm-${requestId}`,
        object: "chat.completion.chunk",
        created: (obj.created as number) ?? Math.floor(Date.now() / 1000),
        model: (obj.model as string) ?? model,
        choices: obj.choices as StreamingChunk["choices"],
        usage: obj.usage as StreamingChunk["usage"],
      };
      if (obj.usage) usage = obj.usage as StreamingChunk["usage"];
      continue;
    }

    if ("type" in obj && obj.type === "content_block_delta") {
      const delta = (obj.delta as Record<string, string>)?.text ?? "";
      yield {
        id: `mm-${requestId}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, delta: { role: "assistant", content: delta }, finish_reason: null }],
      };
      continue;
    }

    if ("message" in obj) {
      const message = obj.message as Record<string, string>;
      yield {
        id: `mm-${requestId}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, delta: { role: "assistant", content: message.content ?? "" }, finish_reason: obj.done ? "stop" : null }],
      };
      if (obj.usage) usage = obj.usage as StreamingChunk["usage"];
      continue;
    }

    const text = (obj.content as string) ?? (obj.text as string) ?? "";
    if (text || obj.done) {
      yield {
        id: `mm-${requestId}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: obj.done ? "stop" : null }],
      };
    }
  }

  if (usage) {
    yield {
      id: `mm-${requestId}`,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [],
      usage,
    };
  }
}
