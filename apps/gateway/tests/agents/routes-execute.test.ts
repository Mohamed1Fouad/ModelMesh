import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/agents/engine.js", () => ({
  AgentEngine: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
    registerTool: vi.fn(),
  })),
}));

vi.mock("../../src/agents/workflow-engine.js", () => ({
  WorkflowEngine: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
  })),
}));

vi.mock("../../src/agents/memory-service.js", () => ({
  MemoryService: vi.fn().mockImplementation(() => ({
    addMemory: vi.fn(),
    getMemories: vi.fn(),
  })),
}));

vi.mock("../../src/agents/tool-registry.js", () => ({
  registerBuiltInTools: vi.fn(),
}));

vi.mock("@modelmesh/db", () => ({
  prisma: {
    agent: { findMany: vi.fn(), findUnique: vi.fn() },
    agentSession: { findMany: vi.fn() },
    agentMessage: { findMany: vi.fn() },
    workflow: { findMany: vi.fn(), findUnique: vi.fn() },
    workflowExecution: { findMany: vi.fn() },
    toolDefinition: { findMany: vi.fn() },
  },
}));

vi.mock("../../src/auth/middleware.js", () => ({
  authMiddleware: vi.fn((req, _rep, done) => done()),
  requirePermission: vi.fn((perm) => (req, _rep, done) => done()),
}));

import { registerAgentRoutes } from "../../src/agents/routes.js";
import { AgentEngine } from "../../src/agents/engine.js";
import { WorkflowEngine } from "../../src/agents/workflow-engine.js";
import { MemoryService } from "../../src/agents/memory-service.js";

function buildFastify() {
  const routes: Record<string, { method: string; url: string; handler: Function; preHandler?: Function }[]> = {};
  const hooks: { onRequest: Function[] } = { onRequest: [] };
  const fastify = {
    addHook: (name: string, fn: Function) => hooks[name as keyof typeof hooks].push(fn),
    get: (url: string, opts: any, handler?: Function) => {
      if (!handler) { handler = opts; opts = {}; }
      (routes["GET"] ??= []).push({ method: "GET", url, handler: handler as Function, preHandler: opts?.preHandler });
    },
    post: (url: string, opts: any, handler?: Function) => {
      if (!handler) { handler = opts; opts = {}; }
      (routes["POST"] ??= []).push({ method: "POST", url, handler: handler as Function, preHandler: opts?.preHandler });
    },
    routes,
    hooks,
  };
  return fastify;
}

function makeReply() {
  const sent: Array<{ status: number; payload: unknown }> = [];
  let _status = 200;
  const reply: any = {
    status: vi.fn((code: number) => { _status = code; return reply; }),
    send: vi.fn((payload: unknown) => {
      sent.push({ status: _status, payload });
      return reply;
    }),
    getSent: () => sent,
  };
  return reply;
}

describe("registerAgentRoutes execute & memory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes agent and returns response", async () => {
    const fastify = buildFastify();
    await registerAgentRoutes(fastify as any);
    const route = fastify.routes.POST.find((r) => r.url === "/v1/agents/:id/execute")!;

    const mockEngine = vi.mocked(AgentEngine).mock.results[0]?.value;
    if (mockEngine) {
      mockEngine.execute.mockResolvedValue({ content: "Hello", sessionId: "s1", iteration: 1, done: true });
    }

    const req = { params: { id: "a1" }, body: { messages: [{ role: "user", content: "Hi" }] }, user: { id: "u1" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(200);
    expect(reply.getSent()[0].payload.content).toBe("Hello");
  });

  it("returns 500 on agent execution error", async () => {
    const fastify = buildFastify();
    await registerAgentRoutes(fastify as any);
    const route = fastify.routes.POST.find((r) => r.url === "/v1/agents/:id/execute")!;

    const mockEngine = vi.mocked(AgentEngine).mock.results[0]?.value;
    if (mockEngine) {
      mockEngine.execute.mockRejectedValue(new Error("Agent failed"));
    }

    const req = { params: { id: "a1" }, body: {}, user: { id: "u1" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(500);
    expect(reply.getSent()[0].payload.error.type).toBe("agent_error");
  });

  it("executes workflow and returns execution", async () => {
    const fastify = buildFastify();
    await registerAgentRoutes(fastify as any);
    const route = fastify.routes.POST.find((r) => r.url === "/v1/workflows/:id/execute")!;

    const mockWorkflowEngine = vi.mocked(WorkflowEngine).mock.results[0]?.value;
    if (mockWorkflowEngine) {
      mockWorkflowEngine.execute.mockResolvedValue({ id: "exec-1", status: "completed" });
    }

    const req = { params: { id: "w1" }, body: { input: "test" }, user: { id: "u1" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(200);
    expect(reply.getSent()[0].payload.status).toBe("completed");
  });

  it("returns 500 on workflow execution error", async () => {
    const fastify = buildFastify();
    await registerAgentRoutes(fastify as any);
    const route = fastify.routes.POST.find((r) => r.url === "/v1/workflows/:id/execute")!;

    const mockWorkflowEngine = vi.mocked(WorkflowEngine).mock.results[0]?.value;
    if (mockWorkflowEngine) {
      mockWorkflowEngine.execute.mockRejectedValue(new Error("Workflow failed"));
    }

    const req = { params: { id: "w1" }, body: {}, user: { id: "u1" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(500);
    expect(reply.getSent()[0].payload.error.type).toBe("workflow_error");
  });

  it("adds memory via memoryService", async () => {
    const fastify = buildFastify();
    await registerAgentRoutes(fastify as any);
    const route = fastify.routes.POST.find((r) => r.url === "/v1/agents/:id/memory")!;

    const mockMemory = vi.mocked(MemoryService).mock.results[0]?.value;
    if (mockMemory) {
      mockMemory.addMemory.mockResolvedValue({ id: "mem-1", content: "Fact" });
    }

    const req = { params: { id: "a1" }, body: { type: "fact", content: "Sky is blue" }, user: { id: "u1" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(200);
    expect(reply.getSent()[0].payload.id).toBe("mem-1");
  });

  it("queries memories via memoryService", async () => {
    const fastify = buildFastify();
    await registerAgentRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/agents/:id/memory")!;

    const mockMemory = vi.mocked(MemoryService).mock.results[0]?.value;
    if (mockMemory) {
      mockMemory.getMemories.mockResolvedValue([{ id: "mem-1" }]);
    }

    const req = { params: { id: "a1" }, query: { sessionId: "s1", type: "fact", limit: "5" }, user: { id: "u1" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].payload.data).toHaveLength(1);
    if (mockMemory) {
      expect(mockMemory.getMemories).toHaveBeenCalledWith({ agentId: "a1", sessionId: "s1", type: "fact", limit: 5 });
    }
  });
});
