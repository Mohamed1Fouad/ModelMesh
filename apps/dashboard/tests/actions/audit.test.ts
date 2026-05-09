import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAuditLogs, getAuditSummary } from "../../src/actions/audit.js";

vi.mock("@modelmesh/db", () => ({
  prisma: {
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

import { prisma } from "@modelmesh/db";

describe("audit actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAuditLogs returns logs and total", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([{ id: "l1" }] as any);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(1);

    const result = await getAuditLogs({ userId: "u1", teamId: "t1", action: "post", resource: "provider", limit: 10, offset: 0 });
    expect(result.logs).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { userId: "u1", teamId: "t1", action: "post", resource: "provider" },
      orderBy: { timestamp: "desc" },
      take: 10,
      skip: 0,
    });
  });

  it("getAuditLogs uses defaults when no filters", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
    await getAuditLogs();
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { timestamp: "desc" },
      take: 100,
      skip: 0,
    });
  });

  it("getAuditSummary groups by action, resource, user", async () => {
    vi.mocked(prisma.auditLog.groupBy)
      .mockResolvedValueOnce([{ action: "post", _count: 5 }] as any)
      .mockResolvedValueOnce([{ resource: "provider", _count: 3 }] as any)
      .mockResolvedValueOnce([{ userId: "u1", _count: 2 }] as any);

    const result = await getAuditSummary(7);
    expect(result.byAction).toHaveLength(1);
    expect(result.byResource).toHaveLength(1);
    expect(result.byUser).toHaveLength(1);
    expect(prisma.auditLog.groupBy).toHaveBeenCalledTimes(3);
  });
});
