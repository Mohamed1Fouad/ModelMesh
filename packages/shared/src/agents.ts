import type { ChatMessage, ToolDefinition } from "./types.js";

export interface AgentDefinition {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  provider: string;
  model: string;
  tools: string[];
  capabilities: string[];
  memoryEnabled: boolean;
  maxIterations: number;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentRequest {
  agentId: string;
  sessionId?: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  stream?: boolean;
  userId?: string;
  context?: Record<string, unknown>;
}

export interface AgentResponse {
  content: string;
  toolCalls?: AgentToolCall[];
  sessionId: string;
  iteration: number;
  done: boolean;
}

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  error?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  agentId: string;
  name: string;
  inputMapping: Record<string, string>;
  outputMapping: Record<string, string>;
  order: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: "running" | "completed" | "failed";
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  stepResults: WorkflowStepResult[];
}

export interface WorkflowStepResult {
  id: string;
  stepId: string;
  status: "pending" | "running" | "completed" | "failed";
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface AgentMemory {
  id: string;
  sessionId?: string;
  agentId: string;
  type: "conversation" | "fact" | "preference";
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface AgentSession {
  id: string;
  agentId: string;
  userId?: string;
  title?: string;
  status: "active" | "closed";
  messages: AgentMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMessage {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: AgentToolCall[];
  toolCallId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
