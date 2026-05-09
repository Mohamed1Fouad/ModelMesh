"use server";

import { prisma } from "@modelmesh/db";

export async function getUsageStats(days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [totalRequests, totalCostAgg, avgLatency, byProvider, byDay, byModel] = await Promise.all([
    prisma.usageLog.count({ where: { timestamp: { gte: since } } }),
    prisma.usageLog.aggregate({
      where: { timestamp: { gte: since } },
      _sum: { cost: true, promptTokens: true, completionTokens: true },
    }),
    prisma.usageLog.aggregate({
      where: { timestamp: { gte: since } },
      _avg: { latencyMs: true },
    }),
    prisma.usageLog.groupBy({
      by: ["providerId"],
      where: { timestamp: { gte: since } },
      _sum: { cost: true, totalTokens: true },
      _count: true,
    }),
    prisma.usageLog.groupBy({
      by: ["taskType"],
      where: { timestamp: { gte: since } },
      _sum: { cost: true, totalTokens: true },
      _count: true,
    }),
    prisma.usageLog.groupBy({
      by: ["modelId"],
      where: { timestamp: { gte: since } },
      _sum: { cost: true, totalTokens: true },
      _count: true,
    }),
  ]);

  const providers = await prisma.provider.findMany();
  const providerMap = new Map<string, { id: string; displayName: string }>(
    providers.map((p: { id: string; displayName: string }) => [p.id, p]),
  );

  const models = await prisma.model.findMany();
  const modelMap = new Map<string, { id: string; name: string; providerId: string }>(
    models.map((m: { id: string; name: string; providerId: string }) => [m.id, m]),
  );

  return {
    totalRequests,
    totalCost: totalCostAgg._sum.cost ?? 0,
    totalTokens:
      (totalCostAgg._sum.promptTokens ?? 0) + (totalCostAgg._sum.completionTokens ?? 0),
    averageLatencyMs: Math.round(avgLatency._avg.latencyMs ?? 0),
    byProvider: byProvider.map((b: { providerId: string; _count: number; _sum: { cost: number | null; totalTokens: number | null } }) => ({
      providerId: b.providerId,
      providerName: providerMap.get(b.providerId)?.displayName ?? "Unknown",
      requests: b._count,
      cost: b._sum.cost ?? 0,
      tokens: b._sum.totalTokens ?? 0,
    })),
    byTaskType: byDay.map((b: { taskType: string; _count: number; _sum: { cost: number | null; totalTokens: number | null } }) => ({
      taskType: b.taskType,
      requests: b._count,
      cost: b._sum.cost ?? 0,
      tokens: b._sum.totalTokens ?? 0,
    })),
    byModel: byModel.map((b: { modelId: string; _count: number; _sum: { cost: number | null; totalTokens: number | null } }) => ({
      modelId: b.modelId,
      modelName: modelMap.get(b.modelId)?.name ?? "Unknown",
      providerName: providerMap.get(modelMap.get(b.modelId)?.providerId ?? "")?.displayName ?? "Unknown",
      requests: b._count,
      cost: b._sum.cost ?? 0,
      tokens: b._sum.totalTokens ?? 0,
    })),
  };
}

export async function getRecentUsage(limit = 50) {
  return prisma.usageLog.findMany({
    take: limit,
    orderBy: { timestamp: "desc" },
    include: { provider: true, model: true },
  });
}

export async function getHealthHistory(hours = 24) {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  return prisma.healthLog.findMany({
    where: { checkedAt: { gte: since } },
    orderBy: { checkedAt: "desc" },
    include: { provider: true },
  });
}
