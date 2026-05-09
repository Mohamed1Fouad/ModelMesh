import type { ProviderName } from "@modelmesh/shared";
import { OpenAIAdapter } from "./openai.js";
import { AnthropicAdapter } from "./anthropic.js";
import { OllamaAdapter } from "./ollama.js";
import type { ProviderAdapter } from "./base.js";

export function createProviderAdapter(provider: ProviderName): ProviderAdapter {
  switch (provider) {
    case "openai":
      return new OpenAIAdapter();
    case "anthropic":
      return new AnthropicAdapter();
    case "ollama":
      return new OllamaAdapter();
    default:
      return new OpenAIAdapter();
  }
}
