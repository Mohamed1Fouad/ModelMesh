import type { ProviderConfig } from "@modelmesh/shared";
import type { ChatCompletionBody } from "../schemas.js";
import type { ProviderAdapter, ChatCompletionResponse } from "./base.js";

export class OpenAIAdapter implements ProviderAdapter {
  async chatCompletion(body: ChatCompletionBody, config: ProviderConfig, targetModel: string): Promise<ChatCompletionResponse> {
    const url = `${config.baseUrl ?? "https://api.openai.com/v1"}/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
        ...config.defaultHeaders,
      },
      body: JSON.stringify({ ...body, model: targetModel }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    data.model = targetModel;
    return data;
  }

  async chatCompletionStream(body: ChatCompletionBody, config: ProviderConfig, targetModel: string): Promise<AsyncIterable<unknown>> {
    const url = `${config.baseUrl ?? "https://api.openai.com/v1"}/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
        "Accept": "text/event-stream",
        ...config.defaultHeaders,
      },
      body: JSON.stringify({ ...body, model: targetModel, stream: true, stream_options: { include_usage: true } }),
    });

    if (!response.ok || !response.body) {
      const text = await response.text();
      throw new Error(`OpenAI stream error ${response.status}: ${text}`);
    }

    return this.readSSEStream(response.body);
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
