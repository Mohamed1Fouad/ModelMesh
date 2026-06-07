import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerAgentRoutes } from "../../src/agents/routes.js";

vi.mock("@modelmesh/db", () => ({
  prisma: {
    agent: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    agentSession: {
      findMany: vi.fn(),
    },
    agentMessage: {
      findMany: vi.fn(),
    },
    workflow: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    workflowExecution: {
      findMany: vi.fn(),
    },
    toolDefinition: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../src/auth/middleware.js", () => ({
  authMiddleware: vi.fn((req, _rep, done) => done()),
  requirePermission: vi.fn((perm) => (req, _rep, done) => done()),
}));

import { prisma } from "@modelmesh/db";

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
    register: async (plugin: Function) => {
      await plugin(fastify);
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

describe("registerAgentRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers expected routes", async () => {
    const fastify = buildFastify();
    await registerAgentRoutes(fastify as any);
    expect(fastify.hooks.onRequest.length).toBe(1);
    const all = Object.values(fastify.routes).flat();
    expect(all.some((r) => r.method === "GET" && r.url === "/v1/agents")).toBe(true);
    expect(all.some((r) => r.method === "GET" && r.url === "/v1/agents/:id")).toBe(true);
    expect(all.some((r) => r.method === "POST" && r.url === "/v1/agents/:id/execute")).toBe(true);
    expect(all.some((r) => r.method === "GET" && r.url === "/v1/agents/:id/sessions")).toBe(true);
    expect(all.some((r) => r.method === "GET" && r.url === "/v1/agents/sessions/:sessionId/messages")).toBe(true);
    expect(all.some((r) => r.method === "GET" && r.url === "/v1/workflows")).toBe(true);
    expect(all.some((r) => r.method === "GET" && r.url === "/v1/workflows/:id")).toBe(true);
    expect(all.some((r) => r.method === "POST" && r.url === "/v1/workflows/:id/execute")).toBe(true);
    expect(all.some((r) => r.method === "GET" && r.url === "/v1/workflows/:id/executions")).toBe(true);
    expect(all.some((r) => r.method === "POST" && r.url === "/v1/agents/:id/memory")).toBe(true);
    expect(all.some((r) => r.method === "GET" && r.url === "/v1/agents/:id/memory")).toBe(true);
    expect(all.some((r) => r.method === "GET" && r.url === "/v1/tools")).toBe(true);
    expect(all.some((r) => r.method === "POST" && r.url === "/v1/tools/:name/execute")).toBe(true);
  });

  it("lists agents", async () => {
    const fastify = buildFastify();
    await registerAgentRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/agents")!;

    vi.mocked(prisma.agent.findMany).mockResolvedValue([{ id: "a1", name: "Test", description: "Desc", provider: { name: "openai" }, model: { externalId: "gpt-4o" }, capabilities: ["chat"], tools: [], memoryEnabled: false }] as any);

    const req = { user: { id: "u1", role: "user", teamRole: "developer" }, params: {}, query: {}, body: {} } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].payload.data).toHaveLength(1);
    expect(reply.getSent()[0].payload.data[0].name).toBe("Test");
  });

  it("gets agent details", async () => {
    const fastify = buildFastify();
    await registerAgentRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/agents/:id")!;

    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ id: "a1", name: "Test" } as any);

    const req = { params: { id: "a1" }, user: { id: "u1", role: "user", teamRole: "developer" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].payload.name).toBe("Test");
  });

  it("returns 404 when agent not found", async () => {
    const fastify = buildFastify();
    await registerAgentRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/agents/:id")!;

    vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);

    const req = { params: { id: "missing" }, user: { id: "u1", role: "user", teamRole: "developer" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(404);
  });

  it("lists agent sessions", async () => {
    const fastify = buildFastify();
    await registerAgentRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/agents/:id/sessions")!;

    vi.mocked(prisma.agentSession.findMany).mockResolvedValue([{ id: "s1" }] as any);

    const req = { params: { id: "a1" }, user: { id: "u1", role: "user", teamRole: "developer" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].payload.data).toHaveLength(1);
  });

  it("gets session messages", async () => {
    const fastify = buildFastify();
    await registerAgentRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/agents/sessions/:sessionId/messages")!;

    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([{ id: "m1" }] as any);

    const req = { params: { sessionId: "s1" }, user: { id: "u1", role: "user", teamRole: "developer" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].payload.data).toHaveLength(1);
  });

  it("lists workflows", async () => {
    const fastify = buildFastify();
    await registerAgentRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/workflows")!;

    vi.mocked(prisma.workflow.findMany).mockResolvedValue([{ id: "w1", name: "WF" }] as any);

    const req = { user: { id: "u1", role: "user", teamRole: "developer" }, params: {}, query: {}, body: {} } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].payload.data).toHaveLength(1);
  });

  it("gets workflow details", async () => {
    const fastify = buildFastify();
    await registerAgentRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/workflows/:id")!;

    vi.mocked(prisma.workflow.findUnique).mockResolvedValue({ id: "w1", name: "WF" } as any);

    const req = { params: { id: "w1" }, user: { id: "u1", role: "user", teamRole: "developer" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].payload.name).toBe("WF");
  });

  it("returns 404 when workflow not found", async () => {
    const fastify = buildFastify();
    await registerAgentRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/workflows/:id")!;

    vi.mocked(prisma.workflow.findUnique).mockResolvedValue(null);

    const req = { params: { id: "missing" }, user: { id: "u1", role: "user", teamRole: "developer" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(404);
  });

  it("lists workflow executions", async () => {
    const fastify = buildFastify();
    await registerAgentRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/workflows/:id/executions")!;

    vi.mocked(prisma.workflowExecution.findMany).mockResolvedValue([{ id: "e1" }] as any);

    const req = { params: { id: "w1" }, user: { id: "u1", role: "user", teamRole: "developer" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].payload.data).toHaveLength(1);
  });

  it("lists tools", async () => {
    const fastify = buildFastify();
    await registerAgentRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/tools")!;

    vi.mocked(prisma.toolDefinition.findMany).mockResolvedValue([{ id: "t1", name: "web_search" }] as any);

    const req = { user: { id: "u1", role: "user", teamRole: "developer" }, params: {}, query: {}, body: {} } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].payload.data).toHaveLength(1);
  });

  it("returns 501 for tool execution endpoint", async () => {
    const fastify = buildFastify();
    await registerAgentRoutes(fastify as any);
    const route = fastify.routes.POST.find((r) => r.url === "/v1/tools/:name/execute")!;

    const req = { params: { name: "web_search" }, user: { id: "u1", role: "user", teamRole: "developer" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(501);
    expect(reply.getSent()[0].payload.error.type).toBe("not_implemented");
  });
});
