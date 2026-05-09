import type { ProviderConfig } from "@modelmesh/shared";
import type { ChatCompletionBody } from "../schemas.js";
import type { ProviderAdapter, ChatCompletionResponse } from "./base.js";

export class AnthropicAdapter implements ProviderAdapter {
  async chatCompletion(body: ChatCompletionBody, config: ProviderConfig, targetModel: string): Promise<ChatCompletionResponse> {
    const url = `${config.baseUrl ?? "https://api.anthropic.com/v1"}/messages`;

    const systemMessage = body.messages.find((m) => m.role === "system");
    const nonSystemMessages = body.messages.filter((m) => m.role !== "system");

    const payload = {
      model: targetModel,
      max_tokens: body.max_tokens ?? 4096,
      temperature: body.temperature,
      top_p: body.top_p,
      system: systemMessage?.content ? this.stringifyContent(systemMessage.content) : undefined,
      messages: nonSystemMessages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: this.stringifyContent(m.content),
      })),
      tools: body.tools?.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      })),
      stream: false,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey ?? "",
        "anthropic-version": "2023-06-01",
        ...config.defaultHeaders,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.toOpenAIFormat(data, targetModel);
  }

  async chatCompletionStream(body: ChatCompletionBody, config: ProviderConfig, targetModel: string): Promise<AsyncIterable<unknown>> {
    const url = `${config.baseUrl ?? "https://api.anthropic.com/v1"}/messages`;

    const systemMessage = body.messages.find((m) => m.role === "system");
    const nonSystemMessages = body.messages.filter((m) => m.role !== "system");

    const payload = {
      model: targetModel,
      max_tokens: body.max_tokens ?? 4096,
      temperature: body.temperature,
      top_p: body.top_p,
      system: systemMessage?.content ? this.stringifyContent(systemMessage.content) : undefined,
      messages: nonSystemMessages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: this.stringifyContent(m.content),
      })),
      stream: true,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey ?? "",
        "anthropic-version": "2023-06-01",
        "Accept": "text/event-stream",
        ...config.defaultHeaders,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      const text = await response.text();
      throw new Error(`Anthropic stream error ${response.status}: ${text}`);
    }

    return this.readSSEStream(response.body);
  }

  private stringifyContent(content: string | unknown[]): string {
    if (typeof content === "string") return content;
    return JSON.stringify(content);
  }

  private toOpenAIFormat(data: Record<string, unknown>, model: string): ChatCompletionResponse {
    const content = (data.content as Array<Record<string, unknown>>)?.[0];
    const text = content?.type === "text" ? (content.text as string) : "";
    const usage = data.usage as Record<string, number> | undefined;

    return {
      id: (data.id as string) ?? "",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: text },
          finish_reason: (data.stop_reason as string) ?? "stop",
        },
      ],
      usage: usage
        ? {
            prompt_tokens: usage.input_tokens ?? 0,
            completion_tokens: usage.output_tokens ?? 0,
            total_tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
          }
        : undefined,
    };
  }

  private async *readSSEStream(body: ReadableStream<Uint8Array>): AsyncIterable<unknown> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") return;
          if (data) {
            try {
              yield JSON.parse(data);
            } catch {
              // skip malformed
            }
          }
        }
      }
    }
  }
}
