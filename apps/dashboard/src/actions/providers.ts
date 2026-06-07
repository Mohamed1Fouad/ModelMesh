"use server";

import { prisma } from "@modelmesh/db";
import { revalidatePath } from "next/cache";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://gateway:3000";

async function notifyGatewayRefresh() {
  try {
    await fetch(`${GATEWAY_URL}/v1/admin/refresh-providers`, { method: "POST" });
  } catch {
    // Silent fail — gateway may be unreachable during dev
  }
}

export async function getProviders() {
  return prisma.provider.findMany({
    include: { models: { orderBy: { name: "asc" } } },
    orderBy: { displayName: "asc" },
  });
}

export async function getProvider(id: string) {
  return prisma.provider.findUnique({
    where: { id },
    include: { models: true },
  });
}

export async function createProvider(data: {
  name: string;
  displayName: string;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  retries?: number;
  weight?: number;
  monthlyQuotaCost?: number;
}) {
  const provider = await prisma.provider.create({
    data: {
      name: data.name,
      displayName: data.displayName,
      baseUrl: data.baseUrl,
      apiKey: data.apiKey,
      timeoutMs: data.timeoutMs ?? 30000,
      retries: data.retries ?? 3,
      weight: data.weight ?? 1,
      monthlyQuotaCost: data.monthlyQuotaCost,
    },
  });
  revalidatePath("/providers");
  await notifyGatewayRefresh();
  return provider;
}

export async function updateProvider(
  id: string,
  data: {
    displayName?: string;
    baseUrl?: string;
    apiKey?: string;
    enabled?: boolean;
    timeoutMs?: number;
    retries?: number;
    weight?: number;
    monthlyQuotaCost?: number | null;
  }
) {
  const provider = await prisma.provider.update({
    where: { id },
    data,
  });
  revalidatePath("/providers");
  revalidatePath(`/providers/${id}`);
  await notifyGatewayRefresh();
  return provider;
}

export async function deleteProvider(id: string) {
  await prisma.provider.delete({ where: { id } });
  revalidatePath("/providers");
  await notifyGatewayRefresh();
}

export async function createModel(data: {
  providerId: string;
  externalId: string;
  openRouterId?: string;
  name: string;
  contextWindow: number;
  maxTokens?: number;
  capabilities: string[];
  supportsStreaming?: boolean;
  supportsToolUse?: boolean;
  promptPricePer1k?: number;
  completionPricePer1k?: number;
  latencyTtftMs?: number;
  latencyThroughputTokensPerSec?: number;
  monthlyQuotaCost?: number;
}) {
  const model = await prisma.model.create({
    data: {
      providerId: data.providerId,
      externalId: data.externalId,
      openRouterId: data.openRouterId,
      name: data.name,
      contextWindow: data.contextWindow,
      maxTokens: data.maxTokens,
      capabilities: data.capabilities,
      supportsStreaming: data.supportsStreaming ?? true,
      supportsToolUse: data.supportsToolUse ?? false,
      promptPricePer1k: data.promptPricePer1k ?? 0,
      completionPricePer1k: data.completionPricePer1k ?? 0,
      latencyTtftMs: data.latencyTtftMs ?? 500,
      latencyThroughputTokensPerSec: data.latencyThroughputTokensPerSec ?? 50,
      monthlyQuotaCost: data.monthlyQuotaCost,
    },
  });
  revalidatePath("/providers");
  await notifyGatewayRefresh();
  return model;
}

export async function updateModel(
  id: string,
  data: {
    name?: string;
    enabled?: boolean;
    externalId?: string;
    openRouterId?: string | null;
    contextWindow?: number;
    maxTokens?: number;
    capabilities?: string[];
    supportsStreaming?: boolean;
    supportsToolUse?: boolean;
    promptPricePer1k?: number;
    completionPricePer1k?: number;
    latencyTtftMs?: number;
    monthlyQuotaCost?: number | null;
  }
) {
  const model = await prisma.model.update({
    where: { id },
    data,
  });
  revalidatePath("/providers");
  await notifyGatewayRefresh();
  return model;
}

export async function deleteModel(id: string) {
  await prisma.model.delete({ where: { id } });
  revalidatePath("/providers");
  await notifyGatewayRefresh();
}
