import { describe, it, expect, vi, beforeEach } from "vitest";
import { auditLogMiddleware } from "../../src/audit/middleware.js";

vi.mock("@modelmesh/db", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@modelmesh/db";

describe("auditLogMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeRequest(overrides: any = {}) {
    return {
      method: "POST",
      url: "/v1/providers",
      user: { id: "u1", teamId: "t1" },
      ip: "127.0.0.1",
      headers: { "user-agent": "test" },
      body: { name: "OpenAI" },
      query: {},
      params: {},
      ...overrides,
    };
  }

  function makeReply() {
    const events: any[] = [];
    const reply: any = {
      raw: {
        on: (event: string, fn: Function) => { events.push({ event, fn }); },
      },
      _events: events,
    };
    return reply;
  }

  it("creates audit log for mutating request after finish", async () => {
    const req = makeRequest();
    const reply = makeReply();

    await auditLogMiddleware(req as any, reply as any);
    expect(reply._events.length).toBe(1);
    expect(reply._events[0].event).toBe("finish");

    await reply._events[0].fn();

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        teamId: "t1",
        action: "post",
        resource: "provider",
        resourceId: "providers",
        details: { body: { name: "OpenAI" }, query: {}, params: {} },
        ipAddress: "127.0.0.1",
        userAgent: "test",
      },
    });
  });

  it("skips GET requests", async () => {
    const req = makeRequest({ method: "GET" });
    const reply = makeReply();

    await auditLogMiddleware(req as any, reply as any);
    await reply._events[0].fn();

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("skips audit log routes", async () => {
    const req = makeRequest({ url: "/v1/audit-logs" });
    const reply = makeReply();

    await auditLogMiddleware(req as any, reply as any);
    await reply._events[0].fn();

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("infers resource from URL", async () => {
    const resources = [
      { url: "/v1/models", expected: "model" },
      { url: "/v1/rules", expected: "rule" },
      { url: "/v1/api-keys", expected: "key" },
      { url: "/v1/agents", expected: "agent" },
      { url: "/v1/workflows", expected: "workflow" },
      { url: "/v1/teams", expected: "team" },
      { url: "/v1/marketplace", expected: "marketplace" },
      { url: "/v1/chat/completions", expected: "api" },
      { url: "/v1/unknown", expected: "unknown" },
    ];

    for (const { url, expected } of resources) {
      vi.clearAllMocks();
      const req = makeRequest({ url, body: {} });
      const reply = makeReply();
      await auditLogMiddleware(req as any, reply as any);
      await reply._events[0].fn();

      const call = vi.mocked(prisma.auditLog.create).mock.calls[0];
      if (!call) {
        expect(expected).toBe("unknown");
        continue;
      }
      expect((call[0] as any).data.resource).toBe(expected);
    }
  });

  it("infers resource ID from URL last segment", async () => {
    const req = makeRequest({ url: "/v1/providers/prov-12345678" });
    const reply = makeReply();
    await auditLogMiddleware(req as any, reply as any);
    await reply._events[0].fn();

    expect(vi.mocked(prisma.auditLog.create).mock.calls[0][0].data.resourceId).toBe("prov-12345678");
  });

  it("sanitizes sensitive body fields", async () => {
    const req = makeRequest({
      body: {
        apiKey: "secret",
        keyHash: "hash",
        customApiKey: "custom",
        password: "pass",
        token: "tok",
        normal: "ok",
      },
    });
    const reply = makeReply();
    await auditLogMiddleware(req as any, reply as any);
    await reply._events[0].fn();

    const details = vi.mocked(prisma.auditLog.create).mock.calls[0][0].data.details;
    expect(details.body.apiKey).toBe("***");
    expect(details.body.keyHash).toBe("***");
    expect(details.body.customApiKey).toBe("***");
    expect(details.body.password).toBe("***");
    expect(details.body.token).toBe("***");
    expect(details.body.normal).toBe("ok");
  });

  it("does not break on audit log failure", async () => {
    const req = makeRequest();
    const reply = makeReply();
    vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error("DB down"));

    await auditLogMiddleware(req as any, reply as any);
    await expect(reply._events[0].fn()).resolves.not.toThrow();
  });

  it("handles missing user-agent header", async () => {
    const req = makeRequest({ headers: {} });
    const reply = makeReply();

    await auditLogMiddleware(req as any, reply as any);
    await reply._events[0].fn();

    expect(vi.mocked(prisma.auditLog.create).mock.calls[0][0].data.userAgent).toBeNull();
  });
});
