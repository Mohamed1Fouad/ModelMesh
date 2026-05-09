export type ProviderName =
  | "openai"
  | "anthropic"
  | "ollama"
  | "gemini"
  | "groq"
  | "deepseek"
  | "mistral"
  | "openrouter"
  | "lmstudio"
  | "localai"
  | "vllm";

export type ModelCapability =
  | "chat"
  | "completion"
  | "embeddings"
  | "image_generation"
  | "vision"
  | "function_calling"
  | "tool_use"
  | "reasoning"
  | "code"
  | "multimodal"
  | "streaming"
  | "json_mode";

export interface ModelInfo {
  id: string;
  provider: ProviderName;
  name: string;
  capabilities: ModelCapability[];
  contextWindow: number;
  maxTokens?: number;
  pricing: ModelPricing;
  supportsStreaming: boolean;
  supportsToolUse: boolean;
  latencyProfile: LatencyProfile;
}

export interface ModelPricing {
  promptPer1k: number;
  completionPer1k: number;
  currency: string;
}

export interface LatencyProfile {
  ttftMs: number;
  throughputTokensPerSec: number;
  score: number;
}

export interface ProviderConfig {
  name: ProviderName;
  enabled: boolean;
  baseUrl?: string;
  apiKey?: string;
  apiKeyEncrypted?: string;
  models: ModelInfo[];
  defaultHeaders?: Record<string, string>;
  timeoutMs: number;
  retries: number;
  weight: number;
  healthCheck: HealthCheckConfig;
  rateLimit?: RateLimitConfig;
}

export interface HealthCheckConfig {
  enabled: boolean;
  intervalMs: number;
  timeoutMs: number;
  path?: string;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
}

export interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  condition: RoutingCondition;
  action: RoutingAction;
}

export type RoutingCondition =
  | { type: "task_type"; taskType: TaskType }
  | { type: "model_capability"; capability: ModelCapability }
  | { type: "max_price"; pricePer1k: number }
  | { type: "max_latency"; latencyMs: number }
  | { type: "privacy_required"; required: boolean }
  | { type: "provider"; provider: ProviderName }
  | { type: "context_size"; maxTokens: number }
  | { type: "custom"; expression: string };

export type RoutingAction =
  | { type: "route_to"; provider: ProviderName; model?: string }
  | { type: "prefer_local" }
  | { type: "fallback"; providers: ProviderName[] }
  | { type: "score_boost"; provider: ProviderName; boost: number }
  | { type: "reject"; reason: string };

export type TaskType =
  | "chat"
  | "coding"
  | "reasoning"
  | "summarization"
  | "translation"
  | "classification"
  | "embedding"
  | "image_analysis"
  | "agent_orchestration";

export interface RoutingRequest {
  id: string;
  timestamp: Date;
  taskType: TaskType;
  messages: ChatMessage[];
  model?: string;
  preferredProvider?: ProviderName;
  requiredCapabilities: ModelCapability[];
  maxPricePer1k?: number;
  maxLatencyMs?: number;
  privacyRequired: boolean;
  stream: boolean;
  tools?: ToolDefinition[];
  responseFormat?: "text" | "json_object";
  estimatedTokens?: number;
  userId?: string;
  teamId?: string;
  budgetId?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } }
  | { type: "input_audio"; input_audio: { data: string; format: "wav" | "mp3" } };

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface RoutingResult {
  requestId: string;
  selectedProvider: ProviderName;
  selectedModel: string;
  routeReason: string;
  score: number;
  estimatedCost: number;
  estimatedLatencyMs: number;
  alternatives: AlternativeRoute[];
  appliedRules: string[];
}

export interface AlternativeRoute {
  provider: ProviderName;
  model: string;
  score: number;
  estimatedCost: number;
}

export interface ProviderHealth {
  provider: ProviderName;
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  lastChecked: Date;
  latencyMs: number;
  errorRate: number;
  successRate: number;
  consecutiveFailures: number;
  region?: string;
}

export interface UsageRecord {
  id: string;
  requestId: string;
  timestamp: Date;
  provider: ProviderName;
  model: string;
  taskType: TaskType;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  latencyMs: number;
  userId?: string;
  teamId?: string;
  status: "success" | "error" | "cached";
  errorMessage?: string;
}

export interface BudgetAlert {
  id: string;
  userId?: string;
  teamId?: string;
  budgetLimit: number;
  currentSpend: number;
  alertThreshold: number;
  period: "daily" | "weekly" | "monthly";
  notified: boolean;
}

export interface StreamingChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<ChatMessage>;
    finish_reason?: "stop" | "length" | "tool_calls" | "content_filter" | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}