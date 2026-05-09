import type { ProviderConfig } from "@modelmesh/shared";
import type { ChatCompletionBody } from "../schemas.js";
import type { ProviderAdapter, ChatCompletionResponse } from "./base.js";

export class OllamaAdapter implements ProviderAdapter {
  async chatCompletion(body: ChatCompletionBody, config: ProviderConfig, targetModel: string): Promise<ChatCompletionResponse> {
    const url = `${config.baseUrl ?? "http://localhost:11434"}/api/chat`;

    const messages = body.messages.map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        ...config.defaultHeaders,
      },
      body: JSON.stringify({
        model: targetModel,
        messages,
        stream: false,
        options: {
          temperature: body.temperature,
          top_p: body.top_p,
          num_predict: body.max_tokens,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const message = data.message as Record<string, string> | undefined;

    return {
      id: `ollama-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: targetModel,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: message?.content ?? "" },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: (data.prompt_eval_count as number) ?? 0,
        completion_tokens: (data.eval_count as number) ?? 0,
        total_tokens: ((data.prompt_eval_count as number) ?? 0) + ((data.eval_count as number) ?? 0),
      },
    };
  }

  async chatCompletionStream(body: ChatCompletionBody, config: ProviderConfig, targetModel: string): Promise<AsyncIterable<unknown>> {
    const url = `${config.baseUrl ?? "http://localhost:11434"}/api/chat`;

    const messages = body.messages.map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        ...config.defaultHeaders,
      },
      body: JSON.stringify({
        model: targetModel,
        messages,
        stream: true,
        options: {
          temperature: body.temperature,
          top_p: body.top_p,
          num_predict: body.max_tokens,
        },
      }),
    });

    if (!response.ok || !response.body) {
      const text = await response.text();
      throw new Error(`Ollama stream error ${response.status}: ${text}`);
    }

    return this.readNDJSONStream(response.body);
  }

  private async *readNDJSONStream(body: ReadableStream<Uint8Array>): AsyncIterable<unknown> {
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
        if (line.trim()) {
          try {
            yield JSON.parse(line);
          } catch {
            // skip malformed
          }
        }
      }
    }
  }
}
