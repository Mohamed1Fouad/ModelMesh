export const SUPPORTED_PROVIDERS = [
  { name: "openai", displayName: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { name: "anthropic", displayName: "Anthropic", baseUrl: "https://api.anthropic.com/v1" },
  { name: "ollama", displayName: "Ollama", baseUrl: "http://host.docker.internal:11434" },
  { name: "groq", displayName: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
  { name: "gemini", displayName: "Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  { name: "mistral", displayName: "Mistral", baseUrl: "https://api.mistral.ai/v1" },
  { name: "deepseek", displayName: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  { name: "openrouter", displayName: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  { name: "lmstudio", displayName: "LM Studio", baseUrl: "http://localhost:1234/v1" },
  { name: "localai", displayName: "LocalAI", baseUrl: "http://localhost:8080/v1" },
  { name: "vllm", displayName: "vLLM", baseUrl: "http://localhost:8000/v1" },
];

export function getProviderInfo(name: string) {
  return SUPPORTED_PROVIDERS.find((p) => p.name === name.toLowerCase());
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing: {
    prompt: string;
    completion: string;
    image?: string;
    request?: string;
  };
  context_length: number;
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string | null;
  };
}

export function inferCapabilities(model: OpenRouterModel): string[] {
  const caps = [
    "chat",
    "completion",
    "embeddings",
    "image_generation",
    "vision",
    "function_calling",
    "tool_use",
    "reasoning",
    "code",
    "multimodal",
    "streaming",
    "json_mode",
  ];

  const modality = model.architecture?.modality?.toLowerCase() || "";
  const id = model.id.toLowerCase();

  if (!modality.includes("image") && !id.includes("vision")) {
    const idx = caps.indexOf("vision");
    if (idx > -1) caps.splice(idx, 1);
    const idx2 = caps.indexOf("multimodal");
    if (idx2 > -1) caps.splice(idx2, 1);
    const idx3 = caps.indexOf("image_generation");
    if (idx3 > -1) caps.splice(idx3, 1);
  }
  if (!id.includes("code") && !id.includes("coder")) {
    const idx = caps.indexOf("code");
    if (idx > -1) caps.splice(idx, 1);
  }

  return caps;
}
