import type { ChatMessage, ToolDefinition } from "@modelmesh/shared";

export interface ModelMeshClientOptions {
  baseUrl: string;
  apiKey?: string;
  defaultModel?: string;
  timeoutMs?: number;
}

export interface ChatCompletionOptions {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  tools?: ToolDefinition[];
  tool_choice?: string | { type: string; function: { name: string } };
  response_format?: { type: "text" | "json_object" };
  privacy?: boolean;
  stop?: string | string[];
  user?: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string | null; tool_calls?: unknown[] };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamingChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: { role?: string; content?: string | null; tool_calls?: unknown[] };
    finish_reason?: "stop" | "length" | "tool_calls" | "content_filter" | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class ModelMeshClient {
  private options: ModelMeshClientOptions;

  constructor(options: ModelMeshClientOptions) {
    this.options = {
      timeoutMs: 60000,
      ...options,
    };
  }

  async chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.options.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: options.model ?? this.options.defaultModel,
        ...options,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ModelMesh error ${response.status}: ${text}`);
    }

    return response.json() as Promise<ChatCompletionResponse>;
  }

  async *chatCompletionStream(options: ChatCompletionOptions): AsyncGenerator<StreamingChunk> {
    const response = await fetch(`${this.options.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: options.model ?? this.options.defaultModel,
        ...options,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const text = await response.text();
      throw new Error(`ModelMesh stream error ${response.status}: ${text}`);
    }

    const reader = response.body.getReader();
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
              yield JSON.parse(data) as StreamingChunk;
            } catch {
              // skip malformed
            }
          }
        }
      }
    }
  }

  async listModels(): Promise<Array<{ id: string; object: string; created: number; owned_by: string }>> {
    const response = await fetch(`${this.options.baseUrl}/v1/models`, {
      headers: {
        ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ModelMesh error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { data: Array<{ id: string; object: string; created: number; owned_by: string }> };
    return data.data;
  }
}
