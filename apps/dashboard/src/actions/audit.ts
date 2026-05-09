"use server";

import { prisma } from "@modelmesh/db";

export async function getAuditLogs(filters?: {
  userId?: string;
  teamId?: string;
  action?: string;
  resource?: string;
  limit?: number;
  offset?: number;
}) {
  const where = {
    ...(filters?.userId ? { userId: filters.userId } : {}),
    ...(filters?.teamId ? { teamId: filters.teamId } : {}),
    ...(filters?.action ? { action: filters.action } : {}),
    ...(filters?.resource ? { resource: filters.resource } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: filters?.limit ?? 100,
      skip: filters?.offset ?? 0,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}

export async function getAuditSummary(days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [byAction, byResource, byUser] = await Promise.all([
    prisma.auditLog.groupBy({
      by: ["action"],
      where: { timestamp: { gte: since } },
      _count: true,
    }),
    prisma.auditLog.groupBy({
      by: ["resource"],
      where: { timestamp: { gte: since } },
      _count: true,
    }),
    prisma.auditLog.groupBy({
      by: ["userId"],
      where: { timestamp: { gte: since } },
      _count: true,
    }),
  ]);

  return { byAction, byResource, byUser };
}
