"use server";

import { prisma } from "@modelmesh/db";
import { revalidatePath } from "next/cache";

export async function getRoutingRules() {
  return prisma.routingRule.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
}

export async function createRoutingRule(data: {
  name: string;
  priority: number;
  condition: unknown;
  action: unknown;
}) {
  const rule = await prisma.routingRule.create({
    data: {
      name: data.name,
      priority: data.priority,
      condition: data.condition as object,
      action: data.action as object,
    },
  });
  revalidatePath("/routing");
  return rule;
}

export async function updateRoutingRule(
  id: string,
  data: {
    name?: string;
    priority?: number;
    enabled?: boolean;
    condition?: unknown;
    action?: unknown;
  }
) {
  const rule = await prisma.routingRule.update({
    where: { id },
    data: {
      ...data,
      condition: data.condition as object | undefined,
      action: data.action as object | undefined,
    },
  });
  revalidatePath("/routing");
  return rule;
}

export async function deleteRoutingRule(id: string) {
  await prisma.routingRule.delete({ where: { id } });
  revalidatePath("/routing");
}

export async function toggleRoutingRule(id: string, enabled: boolean) {
  const rule = await prisma.routingRule.update({
    where: { id },
    data: { enabled },
  });
  revalidatePath("/routing");
  return rule;
}
