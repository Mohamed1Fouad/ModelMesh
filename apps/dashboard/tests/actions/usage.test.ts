import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUsageStats, getRecentUsage, getHealthHistory } from "../../src/actions/usage.js";

vi.mock("@modelmesh/db", () => ({
  prisma: {
    usageLog: {
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    healthLog: {
      findMany: vi.fn(),
    },
    provider: {
      findMany: vi.fn(),
    },
    model: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@modelmesh/db";

describe("usage actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getUsageStats aggregates all dimensions", async () => {
    vi.mocked(prisma.usageLog.count).mockResolvedValue(100);
    vi.mocked(prisma.usageLog.aggregate)
      .mockResolvedValueOnce({ _sum: { cost: 1.23, promptTokens: 500, completionTokens: 300 } } as any)
      .mockResolvedValueOnce({ _avg: { latencyMs: 250 } } as any);
    vi.mocked(prisma.usageLog.groupBy)
      .mockResolvedValueOnce([{ providerId: "p1", _count: 50, _sum: { cost: 0.8, totalTokens: 400 } }] as any)
      .mockResolvedValueOnce([{ taskType: "chat", _count: 80, _sum: { cost: 1.0, totalTokens: 600 } }] as any)
      .mockResolvedValueOnce([{ modelId: "m1", _count: 60, _sum: { cost: 0.9, totalTokens: 500 } }] as any);
    vi.mocked(prisma.provider.findMany).mockResolvedValue([{ id: "p1", displayName: "OpenAI" }] as any);
    vi.mocked(prisma.model.findMany).mockResolvedValue([{ id: "m1", name: "GPT-4o", providerId: "p1" }] as any);

    const result = await getUsageStats(7);
    expect(result.totalRequests).toBe(100);
    expect(result.totalCost).toBe(1.23);
    expect(result.totalTokens).toBe(800);
    expect(result.averageLatencyMs).toBe(250);
    expect(result.byProvider).toHaveLength(1);
    expect(result.byProvider[0].providerName).toBe("OpenAI");
    expect(result.byTaskType).toHaveLength(1);
    expect(result.byTaskType[0].taskType).toBe("chat");
    expect(result.byModel).toHaveLength(1);
    expect(result.byModel[0].modelName).toBe("GPT-4o");
    expect(result.byModel[0].providerName).toBe("OpenAI");
  });

  it("getUsageStats handles missing provider/model names", async () => {
    vi.mocked(prisma.usageLog.count).mockResolvedValue(0);
    vi.mocked(prisma.usageLog.aggregate)
      .mockResolvedValueOnce({ _sum: { cost: null, promptTokens: null, completionTokens: null } } as any)
      .mockResolvedValueOnce({ _avg: { latencyMs: null } } as any);
    vi.mocked(prisma.usageLog.groupBy).mockResolvedValue([] as any);
    vi.mocked(prisma.provider.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.model.findMany).mockResolvedValue([] as any);

    const result = await getUsageStats(7);
    expect(result.totalCost).toBe(0);
    expect(result.totalTokens).toBe(0);
    expect(result.averageLatencyMs).toBe(0);
    expect(result.byProvider).toHaveLength(0);
    expect(result.byModel).toHaveLength(0);
  });

  it("getRecentUsage returns recent logs with relations", async () => {
    vi.mocked(prisma.usageLog.findMany).mockResolvedValue([{ id: "u1" }] as any);
    const result = await getRecentUsage(20);
    expect(result).toHaveLength(1);
    expect(prisma.usageLog.findMany).toHaveBeenCalledWith({
      take: 20,
      orderBy: { timestamp: "desc" },
      include: { provider: true, model: true },
    });
  });

  it("getHealthHistory returns logs for last N hours", async () => {
    vi.mocked(prisma.healthLog.findMany).mockResolvedValue([{ id: "h1" }] as any);
    const result = await getHealthHistory(24);
    expect(result).toHaveLength(1);
    expect(prisma.healthLog.findMany).toHaveBeenCalledWith({
      where: { checkedAt: { gte: expect.any(Date) } },
      orderBy: { checkedAt: "desc" },
      include: { provider: true },
    });
  });
});
