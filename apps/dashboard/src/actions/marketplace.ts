"use server";

import { prisma } from "@modelmesh/db";
import { revalidatePath } from "next/cache";

export async function getMarketplacePresets(filters?: { category?: string; search?: string }) {
  return prisma.marketplacePreset.findMany({
    where: {
      enabled: true,
      ...(filters?.category ? { category: filters.category } : {}),
      ...(filters?.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { description: { contains: filters.search, mode: "insensitive" } },
              { tags: { has: filters.search } },
            ],
          }
        : {}),
    },
    orderBy: { downloads: "desc" },
  });
}

export async function getMarketplacePreset(id: string) {
  return prisma.marketplacePreset.findUnique({ where: { id } });
}

export async function createMarketplacePreset(data: {
  name: string;
  description?: string;
  category?: string;
  providerName: string;
  modelId: string;
  capabilities?: string[];
  contextWindow?: number;
  pricingPrompt?: number;
  pricingCompletion?: number;
  tags?: string[];
  config?: Record<string, unknown>;
}) {
  const preset = await prisma.marketplacePreset.create({
    data: {
      name: data.name,
      description: data.description,
      category: data.category ?? "general",
      providerName: data.providerName,
      modelId: data.modelId,
      capabilities: data.capabilities ?? [],
      contextWindow: data.contextWindow ?? 4096,
      pricingPrompt: data.pricingPrompt ?? 0,
      pricingCompletion: data.pricingCompletion ?? 0,
      tags: data.tags ?? [],
      config: data.config ?? {},
    },
  });
  revalidatePath("/marketplace");
  return preset;
}

export async function deleteMarketplacePreset(id: string) {
  await prisma.marketplacePreset.delete({ where: { id } });
  revalidatePath("/marketplace");
}
