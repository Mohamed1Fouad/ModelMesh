import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const openai = await prisma.provider.create({
    data: {
      name: "openai",
      displayName: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      enabled: true,
      weight: 1,
      models: {
        create: [
          {
            externalId: "gpt-4o",
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
        ],
      },
    },
  });

  const anthropic = await prisma.provider.create({
    data: {
      name: "anthropic",
      displayName: "Anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      enabled: true,
      weight: 2,
      models: {
        create: [
          {
            externalId: "claude-3-5-sonnet-20241022",
            name: "Claude 3.5 Sonnet",
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
            externalId: "claude-3-opus-20240229",
            name: "Claude 3 Opus",
            contextWindow: 200_000,
            maxTokens: 4096,
            capabilities: ["chat", "vision", "tool_use", "function_calling", "streaming", "json_mode", "reasoning", "code", "multimodal"],
            supportsStreaming: true,
            supportsToolUse: true,
            promptPricePer1k: 0.015,
            completionPricePer1k: 0.075,
            latencyTtftMs: 1200,
            latencyThroughputTokensPerSec: 40,
          },
        ],
      },
    },
  });

  const ollama = await prisma.provider.create({
    data: {
      name: "ollama",
      displayName: "Ollama",
      baseUrl: "http://host.docker.internal:11434",
      enabled: true,
      weight: 3,
      models: {
        create: [
          {
            externalId: "llama3.1:8b",
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
        ],
      },
    },
  });

  await prisma.routingRule.create({
    data: {
      name: "Code tasks to Claude",
      priority: 100,
      enabled: true,
      condition: { type: "task_type", taskType: "coding" },
      action: { type: "score_boost", provider: "anthropic", boost: 30 },
    },
  });

  await prisma.routingRule.create({
    data: {
      name: "Privacy to local",
      priority: 200,
      enabled: true,
      condition: { type: "privacy_required", required: true },
      action: { type: "prefer_local" },
    },
  });

  await prisma.routingRule.create({
    data: {
      name: "Cheap tasks to Ollama",
      priority: 50,
      enabled: true,
      condition: { type: "max_price", pricePer1k: 0.001 },
      action: { type: "route_to", provider: "ollama" },
    },
  });

  await prisma.routingRule.create({
    data: {
      name: "Reasoning to Claude Opus",
      priority: 90,
      enabled: true,
      condition: { type: "task_type", taskType: "reasoning" },
      action: { type: "score_boost", provider: "anthropic", boost: 40 },
    },
  });

  await prisma.budget.create({
    data: {
      name: "Default Monthly Budget",
      limit: 100,
      alertThreshold: 0.8,
      period: "monthly",
    },
  });

  // Seed agents
  const researcher = await prisma.agent.create({
    data: {
      name: "Researcher",
      description: "Researches topics using web search and summarizes findings",
      systemPrompt: "You are a research assistant. Use the web_search tool to find information, then synthesize a clear summary with sources. Be thorough and factual.",
      providerId: openai.id,
      modelId: (await prisma.model.findFirst({ where: { externalId: "gpt-4o" } }))?.id,
      tools: ["web_search", "http_request"],
      capabilities: ["agent_orchestration", "tool_use", "chat", "reasoning"],
      memoryEnabled: true,
      maxIterations: 3,
    },
  });

  const writer = await prisma.agent.create({
    data: {
      name: "Writer",
      description: "Writes blog posts, documentation, and creative content",
      systemPrompt: "You are a skilled technical writer. Write clear, engaging content. Use markdown formatting when appropriate. Adapt your tone to the audience.",
      providerId: anthropic.id,
      modelId: (await prisma.model.findFirst({ where: { externalId: "claude-3-5-sonnet-20241022" } }))?.id,
      tools: ["read_file", "write_file"],
      capabilities: ["agent_orchestration", "chat", "code", "reasoning"],
      memoryEnabled: true,
      maxIterations: 2,
    },
  });

  const coder = await prisma.agent.create({
    data: {
      name: "Coder",
      description: "Writes, reviews, and explains code",
      systemPrompt: "You are a senior software engineer. Write clean, well-documented code. Follow best practices. Explain your reasoning.",
      providerId: openai.id,
      modelId: (await prisma.model.findFirst({ where: { externalId: "gpt-4-turbo" } }))?.id,
      tools: ["read_file", "write_file", "math_evaluate"],
      capabilities: ["agent_orchestration", "tool_use", "chat", "code", "reasoning"],
      memoryEnabled: true,
      maxIterations: 5,
    },
  });

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
  const researchWorkflow = await prisma.workflow.create({
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

  // Seed marketplace presets
  await prisma.marketplacePreset.createMany({
    data: [
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
        name: "Claude 3.5 Sonnet",
        description: "Anthropic's balanced model with excellent reasoning and coding capabilities.",
        category: "coding",
        providerName: "anthropic",
        modelId: "claude-3-5-sonnet-20241022",
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
        name: "Claude 3 Opus",
        description: "Anthropic's most capable model for highly complex tasks and deep reasoning.",
        category: "reasoning",
        providerName: "anthropic",
        modelId: "claude-3-opus-20240229",
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
    ],
    skipDuplicates: true,
  });

  console.log("Seeded providers:", { openai: openai.id, anthropic: anthropic.id, ollama: ollama.id });
  console.log("Seeded agents:", { researcher: researcher.id, writer: writer.id, coder: coder.id });
  console.log("Seeded workflow:", { researchWorkflow: researchWorkflow.id });
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
