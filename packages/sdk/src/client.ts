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

  private async adminFetch(path: string, method: string, body?: Record<string, unknown>) {
    const headers: Record<string, string> = {
      ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
    };
    if (body) headers["Content-Type"] = "application/json";
    const response = await fetch(`${this.options.baseUrl}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ModelMesh error ${response.status}: ${text}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  async listProviders(): Promise<Array<Record<string, unknown>>> {
    const data = (await this.adminFetch("/v1/admin/providers", "GET")) as { data: Array<Record<string, unknown>> };
    return data.data;
  }

  async getProvider(id: string): Promise<Record<string, unknown>> {
    return (await this.adminFetch(`/v1/admin/providers/${id}`, "GET")) as Record<string, unknown>;
  }

  async createProvider(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return (await this.adminFetch("/v1/admin/providers", "POST", body)) as Record<string, unknown>;
  }

  async updateProvider(id: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return (await this.adminFetch(`/v1/admin/providers/${id}`, "PUT", body)) as Record<string, unknown>;
  }

  async deleteProvider(id: string): Promise<null> {
    return await this.adminFetch(`/v1/admin/providers/${id}`, "DELETE") as null;
  }

  async listAdminModels(): Promise<Array<Record<string, unknown>>> {
    const data = (await this.adminFetch("/v1/admin/models", "GET")) as { data: Array<Record<string, unknown>> };
    return data.data;
  }

  async getModel(id: string): Promise<Record<string, unknown>> {
    return (await this.adminFetch(`/v1/admin/models/${id}`, "GET")) as Record<string, unknown>;
  }

  async createModel(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return (await this.adminFetch("/v1/admin/models", "POST", body)) as Record<string, unknown>;
  }

  async updateModel(id: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return (await this.adminFetch(`/v1/admin/models/${id}`, "PUT", body)) as Record<string, unknown>;
  }

  async deleteModel(id: string): Promise<null> {
    return await this.adminFetch(`/v1/admin/models/${id}`, "DELETE") as null;
  }

  // Routing Rules
  async listRules(): Promise<Array<Record<string, unknown>>> {
    const data = (await this.adminFetch("/v1/admin/rules", "GET")) as { data: Array<Record<string, unknown>> };
    return data.data;
  }

  async getRule(id: string): Promise<Record<string, unknown>> {
    return (await this.adminFetch(`/v1/admin/rules/${id}`, "GET")) as Record<string, unknown>;
  }

  async createRule(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return (await this.adminFetch("/v1/admin/rules", "POST", body)) as Record<string, unknown>;
  }

  async updateRule(id: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return (await this.adminFetch(`/v1/admin/rules/${id}`, "PUT", body)) as Record<string, unknown>;
  }

  async deleteRule(id: string): Promise<null> {
    return await this.adminFetch(`/v1/admin/rules/${id}`, "DELETE") as null;
  }

  // API Keys
  async listApiKeys(): Promise<Array<Record<string, unknown>>> {
    const data = (await this.adminFetch("/v1/admin/api-keys", "GET")) as { data: Array<Record<string, unknown>> };
    return data.data;
  }

  async createApiKey(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return (await this.adminFetch("/v1/admin/api-keys", "POST", body)) as Record<string, unknown>;
  }

  async revokeApiKey(id: string): Promise<null> {
    return await this.adminFetch(`/v1/admin/api-keys/${id}`, "DELETE") as null;
  }

  // Catalog
  async getCatalog(provider?: string): Promise<Array<Record<string, unknown>>> {
    const path = provider ? `/v1/admin/catalog?provider=${encodeURIComponent(provider)}` : "/v1/admin/catalog";
    const data = (await this.adminFetch(path, "GET")) as { data: Array<Record<string, unknown>> };
    return data.data;
  }

  // Teams
  async listTeams(): Promise<Array<Record<string, unknown>>> {
    const data = (await this.adminFetch("/v1/teams", "GET")) as { data?: Array<Record<string, unknown>> };
    return data.data ?? data as unknown as Array<Record<string, unknown>>;
  }

  async getTeam(id: string): Promise<Record<string, unknown>> {
    return (await this.adminFetch(`/v1/teams/${id}`, "GET")) as Record<string, unknown>;
  }

  async createTeam(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return (await this.adminFetch("/v1/teams", "POST", body)) as Record<string, unknown>;
  }

  async updateTeam(id: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return (await this.adminFetch(`/v1/teams/${id}`, "PUT", body)) as Record<string, unknown>;
  }

  async deleteTeam(id: string): Promise<null> {
    return await this.adminFetch(`/v1/teams/${id}`, "DELETE") as null;
  }

  async createInvitation(teamId: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return (await this.adminFetch(`/v1/teams/${teamId}/invitations`, "POST", body)) as Record<string, unknown>;
  }

  // Marketplace
  async listMarketplace(): Promise<Array<Record<string, unknown>>> {
    const data = (await this.adminFetch("/v1/marketplace", "GET")) as { data?: Array<Record<string, unknown>> };
    return data.data ?? data as unknown as Array<Record<string, unknown>>;
  }

  async getPreset(id: string): Promise<Record<string, unknown>> {
    return (await this.adminFetch(`/v1/marketplace/${id}`, "GET")) as Record<string, unknown>;
  }

  async installPreset(id: string): Promise<Record<string, unknown>> {
    return (await this.adminFetch(`/v1/marketplace/${id}/install`, "POST")) as Record<string, unknown>;
  }

  // Agents
  async listAgents(): Promise<Array<Record<string, unknown>>> {
    const data = (await this.adminFetch("/v1/agents", "GET")) as { data?: Array<Record<string, unknown>> };
    return data.data ?? data as unknown as Array<Record<string, unknown>>;
  }

  async getAgent(id: string): Promise<Record<string, unknown>> {
    return (await this.adminFetch(`/v1/agents/${id}`, "GET")) as Record<string, unknown>;
  }

  async executeAgent(id: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return (await this.adminFetch(`/v1/agents/${id}/execute`, "POST", body)) as Record<string, unknown>;
  }

  // Workflows
  async listWorkflows(): Promise<Array<Record<string, unknown>>> {
    const data = (await this.adminFetch("/v1/workflows", "GET")) as { data?: Array<Record<string, unknown>> };
    return data.data ?? data as unknown as Array<Record<string, unknown>>;
  }

  async getWorkflow(id: string): Promise<Record<string, unknown>> {
    return (await this.adminFetch(`/v1/workflows/${id}`, "GET")) as Record<string, unknown>;
  }

  async executeWorkflow(id: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return (await this.adminFetch(`/v1/workflows/${id}/execute`, "POST", body)) as Record<string, unknown>;
  }

  // Audit Logs
  async getAuditLogs(query?: Record<string, unknown>): Promise<{ data: Array<Record<string, unknown>>; total: number }> {
    const params = new URLSearchParams();
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) params.append(key, String(value));
      }
    }
    const path = `/v1/audit-logs?${params.toString()}`;
    return (await this.adminFetch(path, "GET")) as { data: Array<Record<string, unknown>>; total: number };
  }

  // Refresh
  async refreshProviders(): Promise<Record<string, unknown>> {
    return (await this.adminFetch("/v1/admin/refresh-providers", "POST")) as Record<string, unknown>;
  }

  // Usage & Health
  async getUsageStats(): Promise<Record<string, unknown>> {
    return (await this.adminFetch("/v1/dashboard/stats", "GET")) as Record<string, unknown>;
  }

  async getHealth(): Promise<Record<string, unknown>> {
    return (await this.adminFetch("/v1/dashboard/health", "GET")) as Record<string, unknown>;
  }
}
