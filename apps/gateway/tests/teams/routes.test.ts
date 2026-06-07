import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerTeamRoutes } from "../../src/teams/routes.js";

vi.mock("@modelmesh/db", () => ({
  prisma: {
    teamMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    teamInvitation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    teamProvider: {
      upsert: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((ops) => Promise.all(ops)),
  },
}));

vi.mock("../../src/auth/middleware.js", () => ({
  authMiddleware: vi.fn((req, _rep, done) => done()),
  teamContextMiddleware: vi.fn((req, _rep, done) => done()),
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
    put: (url: string, opts: any, handler?: Function) => {
      if (!handler) { handler = opts; opts = {}; }
      (routes["PUT"] ??= []).push({ method: "PUT", url, handler: handler as Function, preHandler: opts?.preHandler });
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

describe("registerTeamRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers expected routes", async () => {
    const fastify = buildFastify();
    await registerTeamRoutes(fastify as any);
    expect(fastify.hooks.onRequest.length).toBe(2);
    const all = Object.values(fastify.routes).flat();
    expect(all.some((r) => r.method === "GET" && r.url === "/v1/teams")).toBe(true);
    expect(all.some((r) => r.method === "POST" && r.url === "/v1/teams")).toBe(true);
    expect(all.some((r) => r.method === "GET" && r.url === "/v1/teams/:id")).toBe(true);
    expect(all.some((r) => r.method === "PUT" && r.url === "/v1/teams/:id")).toBe(true);
    expect(all.some((r) => r.method === "DELETE" && r.url === "/v1/teams/:id")).toBe(true);
    expect(all.some((r) => r.method === "POST" && r.url === "/v1/teams/:id/invitations")).toBe(true);
    expect(all.some((r) => r.method === "GET" && r.url === "/v1/teams/:id/invitations")).toBe(true);
    expect(all.some((r) => r.method === "POST" && r.url === "/v1/invitations/:token/accept")).toBe(true);
    expect(all.some((r) => r.method === "PUT" && r.url === "/v1/teams/:id/members/:memberId")).toBe(true);
    expect(all.some((r) => r.method === "DELETE" && r.url === "/v1/teams/:id/members/:memberId")).toBe(true);
    expect(all.some((r) => r.method === "PUT" && r.url === "/v1/teams/:id/providers/:providerId")).toBe(true);
  });

  it("lists teams for user", async () => {
    const fastify = buildFastify();
    await registerTeamRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/teams")!;

    vi.mocked(prisma.teamMember.findMany).mockResolvedValue([
      { team: { id: "t1", name: "Engineering", slug: "eng", description: "Dev team", enabled: true }, role: "owner", joinedAt: new Date() },
    ] as any);

    const req = { user: { id: "u1" }, headers: {}, query: {}, body: {}, params: {} } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(200);
    expect(reply.getSent()[0].payload).toEqual({
      data: [{ id: "t1", name: "Engineering", slug: "eng", description: "Dev team", enabled: true, role: "owner", joinedAt: expect.any(Date) }],
    });
  });

  it("returns 401 when no user on list teams", async () => {
    const fastify = buildFastify();
    await registerTeamRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/teams")!;

    const req = { user: undefined, headers: {}, query: {}, body: {}, params: {} } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(401);
  });

  it("gets single team", async () => {
    const fastify = buildFastify();
    await registerTeamRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/teams/:id")!;

    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      id: "t1", name: "Eng", slug: "eng", description: "", enabled: true,
      members: [{ id: "m1", userId: "u1", user: { id: "u1", email: "a@b.com", name: "A", avatar: null }, role: "owner", joinedAt: new Date() }],
      providers: [{ id: "tp1", providerId: "p1", provider: { name: "OpenAI" }, enabled: true, customBaseUrl: null, weight: 1 }],
      budgets: [],
    } as any);

    const req = { params: { id: "t1" }, user: { id: "u1", role: "user", teamRole: "owner" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(200);
    expect(reply.getSent()[0].payload.members).toHaveLength(1);
  });

  it("returns 404 when team not found", async () => {
    const fastify = buildFastify();
    await registerTeamRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/teams/:id")!;

    vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

    const req = { params: { id: "missing" }, user: { id: "u1", role: "user", teamRole: "owner" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(404);
  });

  it("creates team", async () => {
    const fastify = buildFastify();
    await registerTeamRoutes(fastify as any);
    const route = fastify.routes.POST.find((r) => r.url === "/v1/teams")!;

    vi.mocked(prisma.team.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.team.create).mockResolvedValue({ id: "t1", name: "Eng", slug: "eng" } as any);

    const req = { user: { id: "u1" }, body: { name: "Eng", slug: "eng" }, headers: {}, query: {}, params: {} } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(201);
    expect(reply.getSent()[0].payload).toEqual({ id: "t1", name: "Eng", slug: "eng" });
  });

  it("returns 400 when name or slug missing on create", async () => {
    const fastify = buildFastify();
    await registerTeamRoutes(fastify as any);
    const route = fastify.routes.POST.find((r) => r.url === "/v1/teams")!;

    const req = { user: { id: "u1" }, body: {}, headers: {}, query: {}, params: {} } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(400);
  });

  it("returns 409 on duplicate slug", async () => {
    const fastify = buildFastify();
    await registerTeamRoutes(fastify as any);
    const route = fastify.routes.POST.find((r) => r.url === "/v1/teams")!;

    vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: "existing" } as any);

    const req = { user: { id: "u1" }, body: { name: "Eng", slug: "eng" }, headers: {}, query: {}, params: {} } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(409);
  });

  it("updates team", async () => {
    const fastify = buildFastify();
    await registerTeamRoutes(fastify as any);
    const route = fastify.routes.PUT.find((r) => r.url === "/v1/teams/:id")!;

    vi.mocked(prisma.team.update).mockResolvedValue({ id: "t1", name: "New", slug: "eng", enabled: true } as any);

    const req = { params: { id: "t1" }, body: { name: "New" }, user: { id: "u1", role: "user", teamRole: "owner" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(200);
    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { name: "New", description: undefined, enabled: undefined },
    });
  });

  it("deletes team", async () => {
    const fastify = buildFastify();
    await registerTeamRoutes(fastify as any);
    const route = fastify.routes.DELETE.find((r) => r.url === "/v1/teams/:id")!;

    vi.mocked(prisma.team.delete).mockResolvedValue({} as any);

    const req = { params: { id: "t1" }, user: { id: "u1", role: "user", teamRole: "owner" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(204);
  });

  it("creates invitation", async () => {
    const fastify = buildFastify();
    await registerTeamRoutes(fastify as any);
    const route = fastify.routes.POST.find((r) => r.url === "/v1/teams/:id/invitations")!;

    vi.mocked(prisma.teamInvitation.create).mockResolvedValue({ id: "inv-1", email: "new@example.com", role: "developer", token: "abc", expiresAt: new Date() } as any);

    const req = { params: { id: "t1" }, body: { email: "new@example.com", role: "developer" }, user: { id: "u1", role: "user", teamRole: "owner" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(201);
    expect(prisma.teamInvitation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: "new@example.com" }) }));
  });

  it("returns 400 when email missing on invitation", async () => {
    const fastify = buildFastify();
    await registerTeamRoutes(fastify as any);
    const route = fastify.routes.POST.find((r) => r.url === "/v1/teams/:id/invitations")!;

    const req = { params: { id: "t1" }, body: {}, user: { id: "u1", role: "user", teamRole: "owner" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(400);
  });

  it("lists invitations", async () => {
    const fastify = buildFastify();
    await registerTeamRoutes(fastify as any);
    const route = fastify.routes.GET.find((r) => r.url === "/v1/teams/:id/invitations")!;

    vi.mocked(prisma.teamInvitation.findMany).mockResolvedValue([] as any);

    const req = { params: { id: "t1" }, user: { id: "u1", role: "user", teamRole: "owner" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].payload).toEqual({ data: [] });
  });

  it("accepts invitation", async () => {
    const fastify = buildFastify();
    await registerTeamRoutes(fastify as any);
    const route = fastify.routes.POST.find((r) => r.url === "/v1/invitations/:token/accept")!;

    vi.mocked(prisma.teamInvitation.findUnique).mockResolvedValue({ id: "inv-1", teamId: "t1", role: "developer", expiresAt: new Date(Date.now() + 10000), accepted: false } as any);

    const req = { params: { token: "abc" }, user: { id: "u2" }, headers: {}, query: {}, body: {} } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(200);
    expect(reply.getSent()[0].payload).toEqual({ success: true, teamId: "t1" });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("rejects invalid invitation", async () => {
    const fastify = buildFastify();
    await registerTeamRoutes(fastify as any);
    const route = fastify.routes.POST.find((r) => r.url === "/v1/invitations/:token/accept")!;

    vi.mocked(prisma.teamInvitation.findUnique).mockResolvedValue(null);

    const req = { params: { token: "bad" }, user: { id: "u2" }, headers: {}, query: {}, body: {} } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(400);
  });

  it("updates member role", async () => {
    const fastify = buildFastify();
    await registerTeamRoutes(fastify as any);
    const route = fastify.routes.PUT.find((r) => r.url === "/v1/teams/:id/members/:memberId")!;

    vi.mocked(prisma.teamMember.update).mockResolvedValue({ id: "m1", role: "admin" } as any);

    const req = { params: { memberId: "m1" }, body: { role: "admin" }, user: { id: "u1", role: "user", teamRole: "owner" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].payload).toEqual({ id: "m1", role: "admin" });
  });

  it("removes member", async () => {
    const fastify = buildFastify();
    await registerTeamRoutes(fastify as any);
    const route = fastify.routes.DELETE.find((r) => r.url === "/v1/teams/:id/members/:memberId")!;

    vi.mocked(prisma.teamMember.delete).mockResolvedValue({} as any);

    const req = { params: { memberId: "m1" }, user: { id: "u1", role: "user", teamRole: "owner" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].status).toBe(204);
  });

  it("upserts team provider settings", async () => {
    const fastify = buildFastify();
    await registerTeamRoutes(fastify as any);
    const route = fastify.routes.PUT.find((r) => r.url === "/v1/teams/:id/providers/:providerId")!;

    vi.mocked(prisma.teamProvider.upsert).mockResolvedValue({ id: "tp1" } as any);

    const req = { params: { id: "t1", providerId: "p1" }, body: { enabled: false, customBaseUrl: "http://local" }, user: { id: "u1", role: "user", teamRole: "owner" } } as any;
    const reply = makeReply();
    await route.handler(req, reply);

    expect(reply.getSent()[0].payload).toEqual({ id: "tp1" });
    expect(prisma.teamProvider.upsert).toHaveBeenCalledWith({
      where: { teamId_providerId: { teamId: "t1", providerId: "p1" } },
      update: { enabled: false, customBaseUrl: "http://local", customApiKey: undefined, weight: undefined },
      create: { teamId: "t1", providerId: "p1", enabled: false, customBaseUrl: "http://local", customApiKey: undefined, weight: 1 },
    });
  });
});
