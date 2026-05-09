import type { ProviderConfig } from "@modelmesh/shared";
import type { ChatCompletionBody } from "../schemas.js";

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

export interface ProviderAdapter {
  chatCompletion(
    body: ChatCompletionBody,
    config: ProviderConfig,
    targetModel: string
  ): Promise<ChatCompletionResponse>;
  chatCompletionStream(
    body: ChatCompletionBody,
    config: ProviderConfig,
    targetModel: string
  ): Promise<AsyncIterable<unknown>>;
}
