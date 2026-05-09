import { describe, it, expect } from "vitest";
import { createProviderAdapter } from "../../src/providers/factory.js";
import { OpenAIAdapter } from "../../src/providers/openai.js";
import { AnthropicAdapter } from "../../src/providers/anthropic.js";
import { OllamaAdapter } from "../../src/providers/ollama.js";

describe("createProviderAdapter", () => {
  it("returns OpenAIAdapter for openai", () => {
    const adapter = createProviderAdapter("openai");
    expect(adapter).toBeInstanceOf(OpenAIAdapter);
  });

  it("returns AnthropicAdapter for anthropic", () => {
    const adapter = createProviderAdapter("anthropic");
    expect(adapter).toBeInstanceOf(AnthropicAdapter);
  });

  it("returns OllamaAdapter for ollama", () => {
    const adapter = createProviderAdapter("ollama");
    expect(adapter).toBeInstanceOf(OllamaAdapter);
  });

  it("defaults to OpenAIAdapter for unknown provider", () => {
    const adapter = createProviderAdapter("unknown" as any);
    expect(adapter).toBeInstanceOf(OpenAIAdapter);
  });
});
