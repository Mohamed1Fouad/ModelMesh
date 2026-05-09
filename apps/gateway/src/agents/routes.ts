import type { FastifyInstance } from "fastify";
import { prisma } from "@modelmesh/db";
import { AgentEngine } from "./engine.js";
import { WorkflowEngine } from "./workflow-engine.js";
import { MemoryService } from "./memory-service.js";
import { registerBuiltInTools } from "./tool-registry.js";
import { authMiddleware, requirePermission } from "../auth/middleware.js";
import type { AuthenticatedRequest } from "../auth/middleware.js";

export async function registerAgentRoutes(fastify: FastifyInstance) {
  const agentEngine = new AgentEngine();
  registerBuiltInTools(agentEngine);

  const workflowEngine = new WorkflowEngine(agentEngine);
  const memoryService = new MemoryService();

  // Apply auth to all agent management routes
  fastify.addHook("onRequest", authMiddleware);

  // List agents
  fastify.get("/v1/agents", { preHandler: requirePermission("agent:read") }, async (_request: AuthenticatedRequest, reply) => {
    const agents = await prisma.agent.findMany({
      where: { enabled: true },
      include: { provider: true, model: true },
    });
    return reply.send({
      data: agents.map((a: { id: string; name: string; description: string | null; provider: { name: string } | null; model: { externalId: string } | null; capabilities: string[]; tools: string[]; memoryEnabled: boolean }) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        provider: a.provider?.name,
        model: a.model?.externalId,
        capabilities: a.capabilities,
        tools: a.tools,
        memoryEnabled: a.memoryEnabled,
      })),
    });
  });

  // Get agent details
  fastify.get("/v1/agents/:id", { preHandler: requirePermission("agent:read") }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const agent = await prisma.agent.findUnique({
      where: { id },
      include: { provider: true, model: true },
    });
    if (!agent) return reply.status(404).send({ error: { message: "Agent not found" } });
    return reply.send(agent);
  });

  // Execute agent
  fastify.post("/v1/agents/:id/execute", { preHandler: requirePermission("agent:write") }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      messages?: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }>;
      sessionId?: string;
      stream?: boolean;
      userId?: string;
      context?: Record<string, unknown>;
    };

    try {
      const response = await agentEngine.execute({
        agentId: id,
        messages: body.messages ?? [{ role: "user", content: "Hello" }],
        sessionId: body.sessionId,
        stream: body.stream,
        userId: body.userId ?? request.user?.id,
        context: body.context,
      });

      return reply.send(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: { message, type: "agent_error" } });
    }
  });

  // List agent sessions
  fastify.get("/v1/agents/:id/sessions", { preHandler: requirePermission("agent:read") }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const sessions = await prisma.agentSession.findMany({
      where: { agentId: id },
      orderBy: { updatedAt: "desc" },
    });
    return reply.send({ data: sessions });
  });

  // Get session messages
  fastify.get("/v1/agents/sessions/:sessionId/messages", { preHandler: requirePermission("agent:read") }, async (request: AuthenticatedRequest, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const messages = await prisma.agentMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ data: messages });
  });

  // List workflows
  fastify.get("/v1/workflows", { preHandler: requirePermission("workflow:read") }, async (_request: AuthenticatedRequest, reply) => {
    const workflows = await prisma.workflow.findMany({
      where: { enabled: true },
      include: { steps: { include: { agent: true }, orderBy: { order: "asc" } } },
    });
    return reply.send({ data: workflows });
  });

  // Get workflow
  fastify.get("/v1/workflows/:id", { preHandler: requirePermission("workflow:read") }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: { steps: { include: { agent: true }, orderBy: { order: "asc" } } },
    });
    if (!workflow) return reply.status(404).send({ error: { message: "Workflow not found" } });
    return reply.send(workflow);
  });

  // Execute workflow
  fastify.post("/v1/workflows/:id/execute", { preHandler: requirePermission("workflow:write") }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    try {
      const execution = await workflowEngine.execute(id, body);
      return reply.send(execution);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: { message, type: "workflow_error" } });
    }
  });

  // List workflow executions
  fastify.get("/v1/workflows/:id/executions", { preHandler: requirePermission("workflow:read") }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const executions = await prisma.workflowExecution.findMany({
      where: { workflowId: id },
      orderBy: { startedAt: "desc" },
      include: { stepResults: true },
    });
    return reply.send({ data: executions });
  });

  // Memory: Add
  fastify.post("/v1/agents/:id/memory", { preHandler: requirePermission("agent:write") }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      type: "conversation" | "fact" | "preference";
      content: string;
      sessionId?: string;
      embedding?: number[];
      metadata?: Record<string, unknown>;
    };

    const memory = await memoryService.addMemory({
      agentId: id,
      ...body,
    });
    return reply.send(memory);
  });

  // Memory: Query
  fastify.get("/v1/agents/:id/memory", { preHandler: requirePermission("agent:read") }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { sessionId?: string; type?: string; limit?: string };

    const memories = await memoryService.getMemories({
      agentId: id,
      sessionId: query.sessionId,
      type: query.type as "conversation" | "fact" | "preference" | undefined,
      limit: query.limit ? Number(query.limit) : undefined,
    });
    return reply.send({ data: memories });
  });

  // Tools: List
  fastify.get("/v1/tools", { preHandler: requirePermission("agent:read") }, async (_request: AuthenticatedRequest, reply) => {
    const tools = await prisma.toolDefinition.findMany({
      where: { enabled: true },
    });
    return reply.send({ data: tools });
  });

  // Tools: Execute (for testing/debugging)
  fastify.post("/v1/tools/:name/execute", { preHandler: requirePermission("agent:write") }, async (request: AuthenticatedRequest, reply) => {
    const { name } = request.params as { name: string };
    return reply.status(501).send({ error: { message: `Tool execution endpoint not yet implemented for ${name}`, type: "not_implemented" } });
  });
}
