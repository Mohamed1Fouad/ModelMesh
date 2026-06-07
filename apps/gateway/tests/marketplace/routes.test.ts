import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerMarketplaceRoutes } from "../../src/marketplace/routes.js";

vi.mock("@modelmesh/db", () => ({
  prisma: {
    marketplacePreset: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    provider: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    model: {
      upsert: vi.fn(),
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
    delete: (url: string, opts: any, handler?: Function) => {
      if (!handler) { handler = opts; opts = {}; }
      (routes["DELETE"] ??= []).push({ method: "DELETE", url, handler: handler as Function, preHandler: opts?.preHandler });
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
  const reply: any = {
    status: vi.fn((code: number) => { reply._status = code; return reply; }),
    send: vi.fn((payload: unknown) => {
      sent.push({ status: reply._status ?? 200, payload });
      return reply;
    }),
    getSent: () => sent,
  };
  return reply;
}

describe("registerMarketplaceRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers expected routes", async () => {
    const fastify = buildFastify();
    await registerMarketplaceRoutes(fastify as any);
    expect(fastify.hooks.onRequest.length).toBe(1);
    const all = Object.values(fastify.routes).flat();
    expect(all.some((r) => r.method === "GET" && r.url === "/v1/marketplace")).toBe(true);
    expect(all.some((r) => r.method === "GET" && r.url === "/v1/marketplace/:id")).toBe(true);
    expect(all.some((r) => r.method === "POST" && r.url === "/v1/marketplace/:id/install")).toBe(true);
    expect(all.some((r) => r.method === "POST" && r.url === "/v1/marketplace")).toBe(true);
    expect(all.some((r) => r.method === "DELETE" && r.url === "/v1/marketplace/:id")).toBe(true);
  });

  it("lists presets with optional filters", async () => {
    const fastify = buildFastify();
    await registerMarketplaceRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/marketplace")!;

    vi.mocked(prisma.marketplacePreset.findMany).mockResolvedValue([
      { id: "pre-1", name: "Llama 3", description: "Meta model", category: "llm", providerName: "ollama", modelId: "llama3", capabilities: ["chat"], contextWindow: 128000, pricingPrompt: 0, pricingCompletion: 0, tags: ["oss"], downloads: 100, rating: 4.5, config: {} },
    ] as any);

    const req = { query: { category: "llm", search: "llama" }, headers: {}, body: {}, params: {}, user: { id: "u1" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(200);
    expect(reply.getSent()[0].payload.data).toHaveLength(1);
    expect(reply.getSent()[0].payload.data[0].name).toBe("Llama 3");
  });

  it("gets single preset", async () => {
    const fastify = buildFastify();
    await registerMarketplaceRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/marketplace/:id")!;

    vi.mocked(prisma.marketplacePreset.findUnique).mockResolvedValue({ id: "pre-1", name: "Llama 3" } as any);

    const req = { params: { id: "pre-1" }, headers: {}, query: {}, body: {}, user: { id: "u1" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(200);
    expect(reply.getSent()[0].payload.name).toBe("Llama 3");
  });

  it("returns 404 when preset not found", async () => {
    const fastify = buildFastify();
    await registerMarketplaceRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/marketplace/:id")!;

    vi.mocked(prisma.marketplacePreset.findUnique).mockResolvedValue(null);

    const req = { params: { id: "missing" }, headers: {}, query: {}, body: {}, user: { id: "u1" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(404);
  });

  it("installs preset when provider does not exist", async () => {
    const fastify = buildFastify();
    await registerMarketplaceRoutes(fastify as any);
    const route = fastify.routes.POST.find((r) => r.url === "/v1/marketplace/:id/install")!;

    vi.mocked(prisma.marketplacePreset.findUnique).mockResolvedValue({
      id: "pre-1", name: "Llama 3", providerName: "ollama", modelId: "llama3", contextWindow: 128000, capabilities: ["chat", "streaming"], pricingPrompt: 0, pricingCompletion: 0,
    } as any);
    vi.mocked(prisma.provider.upsert).mockResolvedValue({ id: "prov-1" } as any);
    vi.mocked(prisma.model.upsert).mockResolvedValue({ id: "mod-1" } as any);
    vi.mocked(prisma.marketplacePreset.update).mockResolvedValue({} as any);

    const req = { params: { id: "pre-1" }, user: { id: "u1", role: "super_admin" }, headers: {}, query: {}, body: {} } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(201);
    expect(prisma.provider.upsert).toHaveBeenCalled();
    expect(prisma.marketplacePreset.update).toHaveBeenCalledWith({ where: { id: "pre-1" }, data: { downloads: { increment: 1 } } });
  });

  it("installs preset when provider already exists", async () => {
    const fastify = buildFastify();
    await registerMarketplaceRoutes(fastify as any);
    const route = fastify.routes.POST.find((r) => r.url === "/v1/marketplace/:id/install")!;

    vi.mocked(prisma.marketplacePreset.findUnique).mockResolvedValue({ id: "pre-1", providerName: "ollama", modelId: "llama3", contextWindow: 128000, capabilities: ["chat"], pricingPrompt: 0, pricingCompletion: 0 } as any);
    vi.mocked(prisma.provider.upsert).mockResolvedValue({ id: "prov-1" } as any);
    vi.mocked(prisma.model.upsert).mockResolvedValue({ id: "mod-1" } as any);
    vi.mocked(prisma.marketplacePreset.update).mockResolvedValue({} as any);

    const req = { params: { id: "pre-1" }, user: { id: "u1", role: "super_admin" }, headers: {}, query: {}, body: {} } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(201);
    expect(prisma.provider.upsert).toHaveBeenCalled();
  });

  it("returns 404 when installing nonexistent preset", async () => {
    const fastify = buildFastify();
    await registerMarketplaceRoutes(fastify as any);
    const route = fastify.routes.POST.find((r) => r.url === "/v1/marketplace/:id/install")!;

    vi.mocked(prisma.marketplacePreset.findUnique).mockResolvedValue(null);

    const req = { params: { id: "missing" }, user: { id: "u1", role: "super_admin" }, headers: {}, query: {}, body: {} } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(404);
  });

  it("creates marketplace preset", async () => {
    const fastify = buildFastify();
    await registerMarketplaceRoutes(fastify as any);
    const route = fastify.routes.POST.find((r) => r.url === "/v1/marketplace")!;

    vi.mocked(prisma.marketplacePreset.create).mockResolvedValue({ id: "pre-2", name: "Qwen" } as any);

    const req = { body: { name: "Qwen", providerName: "ollama", modelId: "qwen" }, user: { id: "u1", role: "super_admin" }, headers: {}, query: {}, params: {} } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(201);
    expect(prisma.marketplacePreset.create).toHaveBeenCalledWith({
      data: {
        name: "Qwen",
        description: null,
        category: "general",
        providerName: "ollama",
        modelId: "qwen",
        capabilities: [],
        contextWindow: 4096,
        pricingPrompt: 0,
        pricingCompletion: 0,
        config: {},
        tags: [],
      },
    });
  });

  it("lists presets without filters", async () => {
    const fastify = buildFastify();
    await registerMarketplaceRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/marketplace")!;

    vi.mocked(prisma.marketplacePreset.findMany).mockResolvedValue([
      { id: "pre-1", name: "Llama 3", description: "Meta model", category: "llm", providerName: "ollama", modelId: "llama3", capabilities: ["chat"], contextWindow: 128000, pricingPrompt: 0, pricingCompletion: 0, tags: ["oss"], downloads: 100, rating: 4.5, config: {} },
    ] as any);

    const req = { query: {}, headers: {}, body: {}, params: {}, user: { id: "u1" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(200);
    expect(reply.getSent()[0].payload.data).toHaveLength(1);
  });

  it("deletes preset", async () => {
    const fastify = buildFastify();
    await registerMarketplaceRoutes(fastify as any);
    const route = fastify.routes.DELETE.find((r) => r.url === "/v1/marketplace/:id")!;

    vi.mocked(prisma.marketplacePreset.delete).mockResolvedValue({} as any);

    const req = { params: { id: "pre-1" }, user: { id: "u1", role: "super_admin" }, headers: {}, query: {}, body: {} } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(204);
  });
});
