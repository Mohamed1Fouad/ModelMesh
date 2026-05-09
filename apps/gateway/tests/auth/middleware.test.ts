import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { authMiddleware, requirePermission, teamContextMiddleware, type AuthenticatedRequest } from "../../src/auth/middleware.js";
import { prisma } from "@modelmesh/db";

vi.mock("@modelmesh/db", () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userSession: {
      findUnique: vi.fn(),
    },
    teamMember: {
      findUnique: vi.fn(),
    },
  },
}));

function makeRequest(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    headers: {},
    user: undefined,
    query: {},
    body: {},
    params: {},
    ip: "127.0.0.1",
    ...overrides,
  } as AuthenticatedRequest;
}

function makeReply() {
  const sent: Array<{ status: number; payload: unknown }> = [];
  let _status = 200;
  const reply = {
    status: vi.fn((code: number) => { _status = code; return reply; }),
    send: vi.fn((payload: unknown) => {
      sent.push({ status: _status, payload });
      return reply;
    }),
    getSent: () => sent,
  };
  return reply;
}

describe("authMiddleware", () => {
  const originalEnv = process.env.ALLOW_UNAUTHENTICATED;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ALLOW_UNAUTHENTICATED;
  });

  afterEach(() => {
    if (originalEnv) process.env.ALLOW_UNAUTHENTICATED = originalEnv;
    else delete process.env.ALLOW_UNAUTHENTICATED;
  });

  it("authenticates via API key", async () => {
    const keyRecord = {
      id: "key-1",
      name: "prod-key",
      keyHash: "sk-test",
      expiresAt: null,
    };
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(keyRecord as any);
    vi.mocked(prisma.apiKey.update).mockResolvedValue({} as any);

    const request = makeRequest({ headers: { "x-api-key": "sk-test" } });
    const reply = makeReply();

    await authMiddleware(request, reply as any);

    expect(request.user).toEqual({
      id: "api-key",
      email: "prod-key",
      name: "prod-key",
      role: "api_key",
    });
    expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({ where: { keyHash: "sk-test" } });
    expect(prisma.apiKey.update).toHaveBeenCalled();
  });

  it("rejects expired API key", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({
      id: "key-1",
      name: "expired",
      keyHash: "sk-test",
      expiresAt: new Date(Date.now() - 1000),
    } as any);

    const request = makeRequest({ headers: { "x-api-key": "sk-test" } });
    const reply = makeReply();

    const result = await authMiddleware(request, reply as any);

    expect(reply.getSent()).toHaveLength(1);
    expect(reply.getSent()[0].status).toBe(401);
    expect((reply.getSent()[0].payload as any).error.type).toBe("authentication_error");
  });

  it("rejects invalid API key", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null);

    const request = makeRequest({ headers: { "x-api-key": "sk-bad" } });
    const reply = makeReply();

    await authMiddleware(request, reply as any);

    expect(reply.getSent()[0].status).toBe(401);
  });

  it("authenticates via bearer token", async () => {
    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      token: "sess-abc",
      expiresAt: new Date(Date.now() + 10000),
      user: { id: "u-1", email: "test@example.com", name: "Test", role: "admin" },
    } as any);

    const request = makeRequest({ headers: { authorization: "Bearer sess-abc" } });
    const reply = makeReply();

    await authMiddleware(request, reply as any);

    expect(request.user).toEqual({
      id: "u-1",
      email: "test@example.com",
      name: "Test",
      role: "admin",
    });
  });

  it("rejects expired session", async () => {
    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      token: "sess-old",
      expiresAt: new Date(Date.now() - 1000),
      user: { id: "u-1", email: "test@example.com", name: "Test", role: "user" },
    } as any);

    const request = makeRequest({ headers: { authorization: "Bearer sess-old" } });
    const reply = makeReply();

    await authMiddleware(request, reply as any);

    expect(reply.getSent()[0].status).toBe(401);
  });

  it("allows unauthenticated when ALLOW_UNAUTHENTICATED=true", async () => {
    process.env.ALLOW_UNAUTHENTICATED = "true";

    const request = makeRequest();
    const reply = makeReply();

    await authMiddleware(request, reply as any);

    expect(request.user).toEqual({
      id: "anonymous",
      email: "anonymous@local",
      name: "Anonymous",
      role: "user",
    });
    expect(reply.getSent()).toHaveLength(0);
  });

  it("returns 401 when no auth and unauthenticated not allowed", async () => {
    const request = makeRequest();
    const reply = makeReply();

    await authMiddleware(request, reply as any);

    expect(reply.getSent()[0].status).toBe(401);
    expect((reply.getSent()[0].payload as any).error.message).toBe("Authentication required");
  });

  it("increments usage count on API key auth", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({
      id: "key-1",
      name: "test",
      keyHash: "sk-test",
      expiresAt: null,
    } as any);
    vi.mocked(prisma.apiKey.update).mockResolvedValue({} as any);

    const request = makeRequest({ headers: { "x-api-key": "sk-test" } });
    const reply = makeReply();

    await authMiddleware(request, reply as any);

    expect(prisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: "key-1" },
      data: { usageCount: { increment: 1 }, lastUsedAt: expect.any(Date) },
    });
  });
});

describe("requirePermission", () => {
  it("allows super_admin without checking team role", async () => {
    const request = makeRequest({ user: { id: "u-1", email: "a@b.com", name: null, role: "super_admin" } });
    const reply = makeReply();

    const middleware = requirePermission("provider:read");
    await middleware(request, reply as any);

    expect(reply.getSent()).toHaveLength(0);
  });

  it("returns 401 when no user", async () => {
    const request = makeRequest();
    const reply = makeReply();

    const middleware = requirePermission("provider:read");
    await middleware(request, reply as any);

    expect(reply.getSent()[0].status).toBe(401);
  });

  it("returns 403 when no team role", async () => {
    const request = makeRequest({ user: { id: "u-1", email: "a@b.com", name: null, role: "user" } });
    const reply = makeReply();

    const middleware = requirePermission("provider:read");
    await middleware(request, reply as any);

    expect(reply.getSent()[0].status).toBe(403);
    expect((reply.getSent()[0].payload as any).error.type).toBe("authorization_error");
  });

  it("allows owner with wildcard permission", async () => {
    const request = makeRequest({
      user: { id: "u-1", email: "a@b.com", name: null, role: "user", teamRole: "owner" },
    });
    const reply = makeReply();

    const middleware = requirePermission("anything:write");
    await middleware(request, reply as any);

    expect(reply.getSent()).toHaveLength(0);
  });

  it("allows admin with matching permission", async () => {
    const request = makeRequest({
      user: { id: "u-1", email: "a@b.com", name: null, role: "user", teamRole: "admin" },
    });
    const reply = makeReply();

    const middleware = requirePermission("provider:read");
    await middleware(request, reply as any);

    expect(reply.getSent()).toHaveLength(0);
  });

  it("rejects admin without matching permission", async () => {
    const request = makeRequest({
      user: { id: "u-1", email: "a@b.com", name: null, role: "user", teamRole: "admin" },
    });
    const reply = makeReply();

    const middleware = requirePermission("super_secret:write");
    await middleware(request, reply as any);

    expect(reply.getSent()[0].status).toBe(403);
  });

  it("allows developer with matching permission", async () => {
    const request = makeRequest({
      user: { id: "u-1", email: "a@b.com", name: null, role: "user", teamRole: "developer" },
    });
    const reply = makeReply();

    const middleware = requirePermission("agent:write");
    await middleware(request, reply as any);

    expect(reply.getSent()).toHaveLength(0);
  });

  it("rejects developer for admin-only permission", async () => {
    const request = makeRequest({
      user: { id: "u-1", email: "a@b.com", name: null, role: "user", teamRole: "developer" },
    });
    const reply = makeReply();

    const middleware = requirePermission("provider:write");
    await middleware(request, reply as any);

    expect(reply.getSent()[0].status).toBe(403);
  });

  it("allows viewer with read permission", async () => {
    const request = makeRequest({
      user: { id: "u-1", email: "a@b.com", name: null, role: "user", teamRole: "viewer" },
    });
    const reply = makeReply();

    const middleware = requirePermission("provider:read");
    await middleware(request, reply as any);

    expect(reply.getSent()).toHaveLength(0);
  });

  it("rejects viewer for write permission", async () => {
    const request = makeRequest({
      user: { id: "u-1", email: "a@b.com", name: null, role: "user", teamRole: "viewer" },
    });
    const reply = makeReply();

    const middleware = requirePermission("agent:write");
    await middleware(request, reply as any);

    expect(reply.getSent()[0].status).toBe(403);
  });

  it("rejects unknown team role", async () => {
    const request = makeRequest({
      user: { id: "u-1", email: "a@b.com", name: null, role: "user", teamRole: "unknown" },
    });
    const reply = makeReply();

    const middleware = requirePermission("provider:read");
    await middleware(request, reply as any);

    expect(reply.getSent()[0].status).toBe(403);
  });
});

describe("teamContextMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves team from query param", async () => {
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({
      teamId: "team-1",
      role: "developer",
    } as any);

    const request = makeRequest({
      user: { id: "u-1", email: "a@b.com", name: null, role: "user" },
      query: { teamId: "team-1" },
    });
    const reply = makeReply();

    await teamContextMiddleware(request, reply as any);

    expect(request.user?.teamId).toBe("team-1");
    expect(request.user?.teamRole).toBe("developer");
  });

  it("resolves team from body", async () => {
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({
      teamId: "team-2",
      role: "admin",
    } as any);

    const request = makeRequest({
      user: { id: "u-1", email: "a@b.com", name: null, role: "user" },
      body: { teamId: "team-2" },
    });
    const reply = makeReply();

    await teamContextMiddleware(request, reply as any);

    expect(request.user?.teamId).toBe("team-2");
    expect(request.user?.teamRole).toBe("admin");
  });

  it("resolves team from params", async () => {
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({
      teamId: "team-3",
      role: "owner",
    } as any);

    const request = makeRequest({
      user: { id: "u-1", email: "a@b.com", name: null, role: "user" },
      params: { teamId: "team-3" },
    });
    const reply = makeReply();

    await teamContextMiddleware(request, reply as any);

    expect(request.user?.teamId).toBe("team-3");
    expect(request.user?.teamRole).toBe("owner");
  });

  it("skips when no user", async () => {
    const request = makeRequest();
    const reply = makeReply();

    await teamContextMiddleware(request, reply as any);

    expect(prisma.teamMember.findUnique).not.toHaveBeenCalled();
  });

  it("skips for api-key user", async () => {
    const request = makeRequest({
      user: { id: "api-key", email: "key", name: "key", role: "api_key" },
    });
    const reply = makeReply();

    await teamContextMiddleware(request, reply as any);

    expect(prisma.teamMember.findUnique).not.toHaveBeenCalled();
  });

  it("skips for anonymous user", async () => {
    const request = makeRequest({
      user: { id: "anonymous", email: "anon", name: "Anon", role: "user" },
    });
    const reply = makeReply();

    await teamContextMiddleware(request, reply as any);

    expect(prisma.teamMember.findUnique).not.toHaveBeenCalled();
  });

  it("skips when no teamId in request", async () => {
    const request = makeRequest({
      user: { id: "u-1", email: "a@b.com", name: null, role: "user" },
    });
    const reply = makeReply();

    await teamContextMiddleware(request, reply as any);

    expect(prisma.teamMember.findUnique).not.toHaveBeenCalled();
  });

  it("does not set team when membership not found", async () => {
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null);

    const request = makeRequest({
      user: { id: "u-1", email: "a@b.com", name: null, role: "user" },
      query: { teamId: "team-999" },
    });
    const reply = makeReply();

    await teamContextMiddleware(request, reply as any);

    expect(request.user?.teamId).toBeUndefined();
    expect(request.user?.teamRole).toBeUndefined();
  });
});
