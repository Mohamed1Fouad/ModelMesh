import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Upsert providers (create if not exists)
  const openai = await prisma.provider.upsert({
    where: { name: "openai" },
    update: {},
    create: {
      name: "openai",
      displayName: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      enabled: true,
      weight: 1,
    },
  });

  const anthropic = await prisma.provider.upsert({
    where: { name: "anthropic" },
    update: {},
    create: {
      name: "anthropic",
      displayName: "Anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      enabled: true,
      weight: 2,
    },
  });

  const ollama = await prisma.provider.upsert({
    where: { name: "ollama" },
    update: {},
    create: {
      name: "ollama",
      displayName: "Ollama",
      baseUrl: "http://host.docker.internal:11434",
      enabled: true,
      weight: 3,
    },
  });

  // Seed ProviderModelCatalog — internal source of truth for native provider IDs.
  // Maintained manually; updated per release. Dashboard Add Model fetches from here.
  const catalogEntries = [
    // OpenAI
    { providerName: "openai", externalId: "gpt-4o", openRouterId: "openai/gpt-4o", name: "GPT-4o", contextWindow: 128_000, maxTokens: 16_384, capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "multimodal"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.0025, completionPricePer1k: 0.01, latencyTtftMs: 600, tags: ["flagship", "multimodal", "vision"] },
    { providerName: "openai", externalId: "gpt-4o-2024-08-06", openRouterId: "openai/gpt-4o-2024-08-06", name: "GPT-4o (2024-08-06)", contextWindow: 128_000, maxTokens: 16_384, capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "multimodal"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.0025, completionPricePer1k: 0.01, latencyTtftMs: 600, tags: ["snapshot"] },
    { providerName: "openai", externalId: "gpt-4o-mini", openRouterId: "openai/gpt-4o-mini", name: "GPT-4o Mini", contextWindow: 128_000, maxTokens: 16_384, capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "multimodal"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.00015, completionPricePer1k: 0.0006, latencyTtftMs: 300, tags: ["fast", "cheap", "multimodal"] },
    { providerName: "openai", externalId: "gpt-4-turbo", openRouterId: "openai/gpt-4-turbo", name: "GPT-4 Turbo", contextWindow: 128_000, maxTokens: 4096, capabilities: ["chat", "tool_use", "function_calling", "streaming", "json_mode", "code", "reasoning"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.01, completionPricePer1k: 0.03, latencyTtftMs: 800, tags: ["legacy", "reasoning"] },
    { providerName: "openai", externalId: "gpt-4-turbo-preview", openRouterId: "openai/gpt-4-turbo-preview", name: "GPT-4 Turbo Preview", contextWindow: 128_000, maxTokens: 4096, capabilities: ["chat", "tool_use", "function_calling", "streaming", "json_mode", "code", "reasoning"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.01, completionPricePer1k: 0.03, latencyTtftMs: 800, tags: ["preview"] },
    { providerName: "openai", externalId: "o1", openRouterId: "openai/o1", name: "o1", contextWindow: 200_000, maxTokens: 100_000, capabilities: ["chat", "reasoning", "code", "streaming", "json_mode"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.015, completionPricePer1k: 0.06, latencyTtftMs: 1500, tags: ["reasoning", "slow"] },
    { providerName: "openai", externalId: "o1-preview", openRouterId: "openai/o1-preview", name: "o1 Preview", contextWindow: 128_000, maxTokens: 32_768, capabilities: ["chat", "reasoning", "code", "streaming", "json_mode"], supportsStreaming: true, supportsToolUse: false, promptPricePer1k: 0.015, completionPricePer1k: 0.06, latencyTtftMs: 1500, tags: ["reasoning", "preview"] },
    { providerName: "openai", externalId: "o1-mini", openRouterId: "openai/o1-mini", name: "o1 Mini", contextWindow: 128_000, maxTokens: 65_536, capabilities: ["chat", "reasoning", "code", "streaming", "json_mode"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.0011, completionPricePer1k: 0.0044, latencyTtftMs: 800, tags: ["reasoning", "fast"] },
    { providerName: "openai", externalId: "o3-mini", openRouterId: "openai/o3-mini", name: "o3 Mini", contextWindow: 200_000, maxTokens: 100_000, capabilities: ["chat", "reasoning", "code", "streaming", "json_mode"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.0011, completionPricePer1k: 0.0044, latencyTtftMs: 700, tags: ["reasoning", "fast"] },
    { providerName: "openai", externalId: "gpt-3.5-turbo", openRouterId: "openai/gpt-3.5-turbo", name: "GPT-3.5 Turbo", contextWindow: 16_385, maxTokens: 4096, capabilities: ["chat", "tool_use", "function_calling", "streaming", "json_mode"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.0005, completionPricePer1k: 0.0015, latencyTtftMs: 400, tags: ["legacy", "cheap"] },
    { providerName: "openai", externalId: "gpt-3.5-turbo-0125", openRouterId: "openai/gpt-3.5-turbo-0125", name: "GPT-3.5 Turbo (0125)", contextWindow: 16_385, maxTokens: 4096, capabilities: ["chat", "tool_use", "function_calling", "streaming", "json_mode"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.0005, completionPricePer1k: 0.0015, latencyTtftMs: 400, tags: ["snapshot"] },

    // Anthropic
    { providerName: "anthropic", externalId: "claude-opus-4-7", openRouterId: "anthropic/claude-opus-4-7", name: "Claude Opus 4.7", contextWindow: 200_000, maxTokens: 8192, capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "reasoning", "code", "multimodal"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.015, completionPricePer1k: 0.075, latencyTtftMs: 1200, tags: ["premium", "reasoning", "complex"] },
    { providerName: "anthropic", externalId: "claude-opus-4-6", openRouterId: "anthropic/claude-opus-4-6", name: "Claude Opus 4.6", contextWindow: 200_000, maxTokens: 8192, capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "reasoning", "code", "multimodal"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.015, completionPricePer1k: 0.075, latencyTtftMs: 1200, tags: ["premium", "reasoning"] },
    { providerName: "anthropic", externalId: "claude-sonnet-4-6", openRouterId: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6", contextWindow: 200_000, maxTokens: 8192, capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "reasoning", "code", "multimodal"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.003, completionPricePer1k: 0.015, latencyTtftMs: 700, tags: ["balanced", "coding", "vision"] },
    { providerName: "anthropic", externalId: "claude-sonnet-4-5-20250929", openRouterId: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5", contextWindow: 200_000, maxTokens: 8192, capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "reasoning", "code", "multimodal"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.003, completionPricePer1k: 0.015, latencyTtftMs: 700, tags: ["balanced", "coding"] },
    { providerName: "anthropic", externalId: "claude-haiku-4-5-20251001", openRouterId: "anthropic/claude-haiku-4-5", name: "Claude Haiku 4.5", contextWindow: 200_000, maxTokens: 8192, capabilities: ["chat", "vision", "streaming", "json_mode", "multimodal"], supportsStreaming: true, supportsToolUse: false, promptPricePer1k: 0.00025, completionPricePer1k: 0.00125, latencyTtftMs: 300, tags: ["fast", "cheap", "vision"] },
    { providerName: "anthropic", externalId: "claude-3-5-sonnet-20241022", openRouterId: "anthropic/claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet (Retired)", contextWindow: 200_000, maxTokens: 8192, capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "reasoning", "code", "multimodal"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.003, completionPricePer1k: 0.015, latencyTtftMs: 700, tags: ["retired", "legacy"], enabled: false },
    { providerName: "anthropic", externalId: "claude-3-opus-20240229", openRouterId: "anthropic/claude-3-opus-20240229", name: "Claude 3 Opus (Retired)", contextWindow: 200_000, maxTokens: 4096, capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "reasoning", "code", "multimodal"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.015, completionPricePer1k: 0.075, latencyTtftMs: 1200, tags: ["retired", "legacy"], enabled: false },

    // Ollama
    { providerName: "ollama", externalId: "llama3.1:8b", openRouterId: "ollama/llama3.1:8b", name: "Llama 3.1 8B", contextWindow: 128_000, maxTokens: 4096, capabilities: ["chat", "streaming", "json_mode"], supportsStreaming: true, supportsToolUse: false, promptPricePer1k: 0, completionPricePer1k: 0, latencyTtftMs: 400, tags: ["local", "fast", "meta"] },
    { providerName: "ollama", externalId: "llama3.1:70b", openRouterId: "ollama/llama3.1:70b", name: "Llama 3.1 70B", contextWindow: 128_000, maxTokens: 4096, capabilities: ["chat", "streaming", "json_mode", "code", "reasoning"], supportsStreaming: true, supportsToolUse: false, promptPricePer1k: 0, completionPricePer1k: 0, latencyTtftMs: 900, tags: ["local", "meta", "large"] },
    { providerName: "ollama", externalId: "llama3.2:3b", openRouterId: "ollama/llama3.2:3b", name: "Llama 3.2 3B", contextWindow: 128_000, maxTokens: 4096, capabilities: ["chat", "streaming", "json_mode"], supportsStreaming: true, supportsToolUse: false, promptPricePer1k: 0, completionPricePer1k: 0, latencyTtftMs: 250, tags: ["local", "fast", "meta"] },
    { providerName: "ollama", externalId: "mistral:latest", openRouterId: "ollama/mistral", name: "Mistral", contextWindow: 32_000, maxTokens: 4096, capabilities: ["chat", "streaming", "json_mode", "code"], supportsStreaming: true, supportsToolUse: false, promptPricePer1k: 0, completionPricePer1k: 0, latencyTtftMs: 350, tags: ["local", "fast", "coding"] },
    { providerName: "ollama", externalId: "codellama:latest", openRouterId: "ollama/codellama", name: "CodeLlama", contextWindow: 16_000, maxTokens: 4096, capabilities: ["chat", "streaming", "json_mode", "code"], supportsStreaming: true, supportsToolUse: false, promptPricePer1k: 0, completionPricePer1k: 0, latencyTtftMs: 400, tags: ["local", "coding", "meta"] },
    { providerName: "ollama", externalId: "phi4:latest", openRouterId: "ollama/phi4", name: "Phi-4", contextWindow: 16_000, maxTokens: 4096, capabilities: ["chat", "streaming", "json_mode", "code"], supportsStreaming: true, supportsToolUse: false, promptPricePer1k: 0, completionPricePer1k: 0, latencyTtftMs: 300, tags: ["local", "microsoft", "coding"] },
    { providerName: "ollama", externalId: "gemma2:9b", openRouterId: "ollama/gemma2:9b", name: "Gemma 2 9B", contextWindow: 8_000, maxTokens: 4096, capabilities: ["chat", "streaming", "json_mode"], supportsStreaming: true, supportsToolUse: false, promptPricePer1k: 0, completionPricePer1k: 0, latencyTtftMs: 350, tags: ["local", "google", "fast"] },
    { providerName: "ollama", externalId: "qwen2.5:14b", openRouterId: "ollama/qwen2.5:14b", name: "Qwen 2.5 14B", contextWindow: 128_000, maxTokens: 4096, capabilities: ["chat", "streaming", "json_mode", "code"], supportsStreaming: true, supportsToolUse: false, promptPricePer1k: 0, completionPricePer1k: 0, latencyTtftMs: 450, tags: ["local", "alibaba", "coding"] },
    { providerName: "ollama", externalId: "deepseek-r1:14b", openRouterId: "ollama/deepseek-r1:14b", name: "DeepSeek R1 14B", contextWindow: 128_000, maxTokens: 4096, capabilities: ["chat", "streaming", "json_mode", "reasoning", "code"], supportsStreaming: true, supportsToolUse: false, promptPricePer1k: 0, completionPricePer1k: 0, latencyTtftMs: 500, tags: ["local", "reasoning", "deepseek"] },

    // OpenRouter (aggregated third-party providers)
    { providerName: "openrouter", externalId: "meta-llama/llama-3.1-405b-instruct", openRouterId: "meta-llama/llama-3.1-405b-instruct", name: "Llama 3.1 405B (OpenRouter)", contextWindow: 128_000, maxTokens: 4096, capabilities: ["chat", "streaming", "json_mode", "reasoning", "code"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.005, completionPricePer1k: 0.015, latencyTtftMs: 900, tags: ["openrouter", "meta", "large"] },
    { providerName: "openrouter", externalId: "google/gemini-2.0-flash-001", openRouterId: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", contextWindow: 1_000_000, maxTokens: 8192, capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "multimodal"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.00035, completionPricePer1k: 0.00105, latencyTtftMs: 400, tags: ["openrouter", "google", "fast", "vision"] },
    { providerName: "openrouter", externalId: "deepseek/deepseek-chat", openRouterId: "deepseek/deepseek-chat", name: "DeepSeek V3", contextWindow: 64_000, maxTokens: 4096, capabilities: ["chat", "tool_use", "function_calling", "streaming", "json_mode", "reasoning", "code"], supportsStreaming: true, supportsToolUse: true, promptPricePer1k: 0.0005, completionPricePer1k: 0.0015, latencyTtftMs: 600, tags: ["openrouter", "deepseek", "cheap"] },
    { providerName: "openrouter", externalId: "deepseek/deepseek-r1", openRouterId: "deepseek/deepseek-r1", name: "DeepSeek R1", contextWindow: 64_000, maxTokens: 4096, capabilities: ["chat", "streaming", "json_mode", "reasoning", "code"], supportsStreaming: true, supportsToolUse: false, promptPricePer1k: 0.00055, completionPricePer1k: 0.00219, latencyTtftMs: 800, tags: ["openrouter", "deepseek", "reasoning"] },
  ];

  for (const entry of catalogEntries) {
    await prisma.providerModelCatalog.upsert({
      where: { providerName_externalId: { providerName: entry.providerName, externalId: entry.externalId } },
      update: { openRouterId: entry.openRouterId, enabled: entry.enabled ?? true },
      create: { ...entry, enabled: entry.enabled ?? true },
    });
  }

  console.log(`Seeded ${catalogEntries.length} provider model catalog entries`);

  // Seed OpenAI models with correct externalId + openRouterId mapping
  const openaiModels = [
    {
      externalId: "gpt-4o",
      openRouterId: "openai/gpt-4o",
      name: "GPT-4o",
      contextWindow: 128_000,
      maxTokens: 16_384,
      capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "multimodal"],
      supportsStreaming: true,
      supportsToolUse: true,
      promptPricePer1k: 0.0025,
      completionPricePer1k: 0.01,
      latencyTtftMs: 600,
      latencyThroughputTokensPerSec: 80,
    },
    {
      externalId: "gpt-4o-mini",
      openRouterId: "openai/gpt-4o-mini",
      name: "GPT-4o Mini",
      contextWindow: 128_000,
      maxTokens: 16_384,
      capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "multimodal"],
      supportsStreaming: true,
      supportsToolUse: true,
      promptPricePer1k: 0.00015,
      completionPricePer1k: 0.0006,
      latencyTtftMs: 300,
      latencyThroughputTokensPerSec: 120,
    },
    {
      externalId: "gpt-4-turbo",
      openRouterId: "openai/gpt-4-turbo",
      name: "GPT-4 Turbo",
      contextWindow: 128_000,
      maxTokens: 4096,
      capabilities: ["chat", "tool_use", "function_calling", "streaming", "json_mode", "code", "reasoning"],
      supportsStreaming: true,
      supportsToolUse: true,
      promptPricePer1k: 0.01,
      completionPricePer1k: 0.03,
      latencyTtftMs: 800,
      latencyThroughputTokensPerSec: 60,
    },
    {
      externalId: "o1",
      openRouterId: "openai/o1",
      name: "o1",
      contextWindow: 200_000,
      maxTokens: 100_000,
      capabilities: ["chat", "reasoning", "code", "streaming", "json_mode"],
      supportsStreaming: true,
      supportsToolUse: true,
      promptPricePer1k: 0.015,
      completionPricePer1k: 0.06,
      latencyTtftMs: 1500,
      latencyThroughputTokensPerSec: 30,
    },
    {
      externalId: "o1-mini",
      openRouterId: "openai/o1-mini",
      name: "o1 Mini",
      contextWindow: 128_000,
      maxTokens: 65_536,
      capabilities: ["chat", "reasoning", "code", "streaming", "json_mode"],
      supportsStreaming: true,
      supportsToolUse: true,
      promptPricePer1k: 0.0011,
      completionPricePer1k: 0.0044,
      latencyTtftMs: 800,
      latencyThroughputTokensPerSec: 60,
    },
    {
      externalId: "o3-mini",
      openRouterId: "openai/o3-mini",
      name: "o3 Mini",
      contextWindow: 200_000,
      maxTokens: 100_000,
      capabilities: ["chat", "reasoning", "code", "streaming", "json_mode"],
      supportsStreaming: true,
      supportsToolUse: true,
      promptPricePer1k: 0.0011,
      completionPricePer1k: 0.0044,
      latencyTtftMs: 700,
      latencyThroughputTokensPerSec: 70,
    },
  ];

  for (const m of openaiModels) {
    await prisma.model.upsert({
      where: { providerId_externalId: { providerId: openai.id, externalId: m.externalId } },
      update: { openRouterId: m.openRouterId },
      create: { ...m, providerId: openai.id },
    });
  }

  // Seed Anthropic models with correct native externalId + openRouterId mapping
  // Anthropic uses pinned snapshot IDs; aliases like claude-sonnet-4-6 resolve to the latest snapshot
  const anthropicModels = [
    {
      externalId: "claude-opus-4-7",
      openRouterId: "anthropic/claude-opus-4-7",
      name: "Claude Opus 4.7",
      contextWindow: 200_000,
      maxTokens: 8192,
      capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "reasoning", "code", "multimodal"],
      supportsStreaming: true,
      supportsToolUse: true,
      promptPricePer1k: 0.015,
      completionPricePer1k: 0.075,
      latencyTtftMs: 1200,
      latencyThroughputTokensPerSec: 40,
    },
    {
      externalId: "claude-sonnet-4-6",
      openRouterId: "anthropic/claude-sonnet-4-6",
      name: "Claude Sonnet 4.6",
      contextWindow: 200_000,
      maxTokens: 8192,
      capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "reasoning", "code", "multimodal"],
      supportsStreaming: true,
      supportsToolUse: true,
      promptPricePer1k: 0.003,
      completionPricePer1k: 0.015,
      latencyTtftMs: 700,
      latencyThroughputTokensPerSec: 70,
    },
    {
      externalId: "claude-sonnet-4-5-20250929",
      openRouterId: "anthropic/claude-sonnet-4-5",
      name: "Claude Sonnet 4.5",
      contextWindow: 200_000,
      maxTokens: 8192,
      capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "reasoning", "code", "multimodal"],
      supportsStreaming: true,
      supportsToolUse: true,
      promptPricePer1k: 0.003,
      completionPricePer1k: 0.015,
      latencyTtftMs: 700,
      latencyThroughputTokensPerSec: 70,
    },
    {
      externalId: "claude-haiku-4-5-20251001",
      openRouterId: "anthropic/claude-haiku-4-5",
      name: "Claude Haiku 4.5",
      contextWindow: 200_000,
      maxTokens: 8192,
      capabilities: ["chat", "vision", "streaming", "json_mode", "multimodal"],
      supportsStreaming: true,
      supportsToolUse: false,
      promptPricePer1k: 0.00025,
      completionPricePer1k: 0.00125,
      latencyTtftMs: 300,
      latencyThroughputTokensPerSec: 120,
    },
  ];

  for (const m of anthropicModels) {
    await prisma.model.upsert({
      where: { providerId_externalId: { providerId: anthropic.id, externalId: m.externalId } },
      update: { openRouterId: m.openRouterId },
      create: { ...m, providerId: anthropic.id },
    });
  }

  // Seed Ollama models
  const ollamaModels = [
    {
      externalId: "llama3.1:8b",
      openRouterId: "ollama/llama3.1:8b",
      name: "Llama 3.1 8B",
      contextWindow: 128_000,
      maxTokens: 4096,
      capabilities: ["chat", "streaming", "json_mode"],
      supportsStreaming: true,
      supportsToolUse: false,
      promptPricePer1k: 0,
      completionPricePer1k: 0,
      latencyTtftMs: 400,
      latencyThroughputTokensPerSec: 100,
    },
    {
      externalId: "llama3.1:70b",
      openRouterId: "ollama/llama3.1:70b",
      name: "Llama 3.1 70B",
      contextWindow: 128_000,
      maxTokens: 4096,
      capabilities: ["chat", "streaming", "json_mode", "code", "reasoning"],
      supportsStreaming: true,
      supportsToolUse: false,
      promptPricePer1k: 0,
      completionPricePer1k: 0,
      latencyTtftMs: 900,
      latencyThroughputTokensPerSec: 50,
    },
    {
      externalId: "mistral:latest",
      openRouterId: "ollama/mistral",
      name: "Mistral",
      contextWindow: 32_000,
      maxTokens: 4096,
      capabilities: ["chat", "streaming", "json_mode", "code"],
      supportsStreaming: true,
      supportsToolUse: false,
      promptPricePer1k: 0,
      completionPricePer1k: 0,
      latencyTtftMs: 350,
      latencyThroughputTokensPerSec: 110,
    },
  ];

  for (const m of ollamaModels) {
    await prisma.model.upsert({
      where: { providerId_externalId: { providerId: ollama.id, externalId: m.externalId } },
      update: { openRouterId: m.openRouterId },
      create: { ...m, providerId: ollama.id },
    });
  }

  // Seed routing rules
  const rules = [
    {
      name: "Code tasks to Claude",
      priority: 100,
      enabled: true,
      condition: { type: "task_type", taskType: "coding" },
      action: { type: "score_boost", provider: "anthropic", boost: 30 },
    },
    {
      name: "Privacy to local",
      priority: 200,
      enabled: true,
      condition: { type: "privacy_required", required: true },
      action: { type: "prefer_local" },
    },
    {
      name: "Cheap tasks to Ollama",
      priority: 50,
      enabled: true,
      condition: { type: "max_price", pricePer1k: 0.001 },
      action: { type: "route_to", provider: "ollama" },
    },
    {
      name: "Reasoning to Claude Opus",
      priority: 90,
      enabled: true,
      condition: { type: "task_type", taskType: "reasoning" },
      action: { type: "score_boost", provider: "anthropic", boost: 40 },
    },
  ];

  for (const rule of rules) {
    const existing = await prisma.routingRule.findFirst({ where: { name: rule.name } });
    if (!existing) {
      await prisma.routingRule.create({ data: rule });
    }
  }

  // Seed budget
  const existingBudget = await prisma.budget.findFirst({ where: { name: "Default Monthly Budget" } });
  if (!existingBudget) {
    await prisma.budget.create({
      data: {
        name: "Default Monthly Budget",
        limit: 100,
        alertThreshold: 0.8,
        period: "monthly",
      },
    });
  }

  // Seed agents (resolve model IDs dynamically)
  const gpt4o = await prisma.model.findFirst({ where: { externalId: "gpt-4o", providerId: openai.id } });
  const claudeSonnet = await prisma.model.findFirst({ where: { externalId: "claude-sonnet-4-6", providerId: anthropic.id } });
  const gpt4turbo = await prisma.model.findFirst({ where: { externalId: "gpt-4-turbo", providerId: openai.id } });

  let researcher = null;
  if (gpt4o) {
    researcher = await prisma.agent.findFirst({ where: { name: "Researcher" } });
    if (!researcher) {
      researcher = await prisma.agent.create({
        data: {
          name: "Researcher",
          description: "Researches topics using web search and summarizes findings",
          systemPrompt: "You are a research assistant. Use the web_search tool to find information, then synthesize a clear summary with sources. Be thorough and factual.",
          providerId: openai.id,
          modelId: gpt4o.id,
          tools: ["web_search", "http_request"],
          capabilities: ["agent_orchestration", "tool_use", "chat", "reasoning"],
          memoryEnabled: true,
          maxIterations: 3,
        },
      });
    }
  }

  let writer = null;
  if (claudeSonnet) {
    writer = await prisma.agent.findFirst({ where: { name: "Writer" } });
    if (!writer) {
      writer = await prisma.agent.create({
        data: {
          name: "Writer",
          description: "Writes blog posts, documentation, and creative content",
          systemPrompt: "You are a skilled technical writer. Write clear, engaging content. Use markdown formatting when appropriate. Adapt your tone to the audience.",
          providerId: anthropic.id,
          modelId: claudeSonnet.id,
          tools: ["read_file", "write_file"],
          capabilities: ["agent_orchestration", "chat", "code", "reasoning"],
          memoryEnabled: true,
          maxIterations: 2,
        },
      });
    }
  }

  let coder = null;
  if (gpt4turbo) {
    coder = await prisma.agent.findFirst({ where: { name: "Coder" } });
    if (!coder) {
      coder = await prisma.agent.create({
        data: {
          name: "Coder",
          description: "Writes, reviews, and explains code",
          systemPrompt: "You are a senior software engineer. Write clean, well-documented code. Follow best practices. Explain your reasoning.",
          providerId: openai.id,
          modelId: gpt4turbo.id,
          tools: ["read_file", "write_file", "math_evaluate"],
          capabilities: ["agent_orchestration", "tool_use", "chat", "code", "reasoning"],
          memoryEnabled: true,
          maxIterations: 5,
        },
      });
    }
  }

  // Seed tool definitions
  await prisma.toolDefinition.createMany({
    data: [
      {
        name: "web_search",
        description: "Search the web for information",
        parameters: { type: "object", properties: { query: { type: "string", description: "Search query" } }, required: ["query"] },
        handler: "builtin:web_search",
      },
      {
        name: "http_request",
        description: "Make an HTTP request to any URL",
        parameters: { type: "object", properties: { url: { type: "string" }, method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] }, headers: { type: "object" }, body: { type: "string" } }, required: ["url"] },
        handler: "builtin:http_request",
      },
      {
        name: "read_file",
        description: "Read the contents of a file",
        parameters: { type: "object", properties: { path: { type: "string", description: "File path" } }, required: ["path"] },
        handler: "builtin:read_file",
      },
      {
        name: "write_file",
        description: "Write content to a file",
        parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
        handler: "builtin:write_file",
      },
      {
        name: "math_evaluate",
        description: "Evaluate a mathematical expression",
        parameters: { type: "object", properties: { expression: { type: "string" } }, required: ["expression"] },
        handler: "builtin:math_evaluate",
      },
      {
        name: "date_time",
        description: "Get current date and time",
        parameters: { type: "object", properties: {} },
        handler: "builtin:date_time",
      },
    ],
    skipDuplicates: true,
  });

  // Seed workflow
  let researchWorkflow = null;
  if (researcher && writer) {
    researchWorkflow = await prisma.workflow.findFirst({ where: { name: "Research & Write" } });
    if (!researchWorkflow) {
      researchWorkflow = await prisma.workflow.create({
        data: {
          name: "Research & Write",
          description: "Research a topic and write a blog post about it",
          enabled: true,
        },
      });

      await prisma.workflowStep.createMany({
        data: [
          {
            workflowId: researchWorkflow.id,
            agentId: researcher.id,
            name: "Research Topic",
            inputMapping: { topic: "topic" },
            outputMapping: { _content: "research_notes" },
            order: 1,
          },
          {
            workflowId: researchWorkflow.id,
            agentId: writer.id,
            name: "Write Blog Post",
            inputMapping: { research: "research_notes", topic: "topic" },
            outputMapping: { _content: "blog_post" },
            order: 2,
          },
        ],
      });
    }
  }

  // Seed marketplace presets (upsert to avoid duplicates)
  const presets = [
    {
      name: "GPT-4o",
      description: "OpenAI's flagship multimodal model. Best for general tasks, vision, and complex reasoning.",
      category: "general",
      providerName: "openai",
      modelId: "gpt-4o",
      capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "multimodal"],
      contextWindow: 128_000,
      pricingPrompt: 0.0025,
      pricingCompletion: 0.01,
      tags: ["openai", "multimodal", "vision", "general"],
    },
    {
      name: "Claude Sonnet 4.6",
      description: "Anthropic's balanced model with excellent reasoning and coding capabilities.",
      category: "coding",
      providerName: "anthropic",
      modelId: "claude-sonnet-4-6",
      capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "reasoning", "code", "multimodal"],
      contextWindow: 200_000,
      pricingPrompt: 0.003,
      pricingCompletion: 0.015,
      tags: ["anthropic", "coding", "reasoning", "long-context"],
    },
    {
      name: "Llama 3.1 8B",
      description: "Meta's efficient open-weights model. Great for local deployment and privacy-sensitive tasks.",
      category: "local",
      providerName: "ollama",
      modelId: "llama3.1:8b",
      capabilities: ["chat", "streaming", "json_mode"],
      contextWindow: 128_000,
      pricingPrompt: 0,
      pricingCompletion: 0,
      tags: ["ollama", "local", "privacy", "open-source"],
    },
    {
      name: "Claude Opus 4.7",
      description: "Anthropic's most capable model for highly complex tasks and deep reasoning.",
      category: "reasoning",
      providerName: "anthropic",
      modelId: "claude-opus-4-7",
      capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "reasoning", "code", "multimodal"],
      contextWindow: 200_000,
      pricingPrompt: 0.015,
      pricingCompletion: 0.075,
      tags: ["anthropic", "reasoning", "complex", "premium"],
    },
    {
      name: "Mistral",
      description: "Fast and efficient open-weights model via Ollama. Good for quick local inference.",
      category: "local",
      providerName: "ollama",
      modelId: "mistral:latest",
      capabilities: ["chat", "streaming", "json_mode", "code"],
      contextWindow: 32_000,
      pricingPrompt: 0,
      pricingCompletion: 0,
      tags: ["ollama", "local", "fast", "coding"],
    },
  ];

  for (const preset of presets) {
    const existing = await prisma.marketplacePreset.findFirst({
      where: { name: preset.name, providerName: preset.providerName },
    });
    if (!existing) {
      await prisma.marketplacePreset.create({ data: preset });
    }
  }

  console.log("Seeded providers:", { openai: openai.id, anthropic: anthropic.id, ollama: ollama.id });
  console.log("Seeded agents:", { researcher: researcher?.id, writer: writer?.id, coder: coder?.id });
  console.log("Seeded workflow:", { researchWorkflow: researchWorkflow?.id });
  console.log("Seeded marketplace presets");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
