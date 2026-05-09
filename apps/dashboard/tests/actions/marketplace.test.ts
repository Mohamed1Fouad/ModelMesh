import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMarketplacePresets, getMarketplacePreset, createMarketplacePreset, deleteMarketplacePreset } from "../../src/actions/marketplace.js";

vi.mock("@modelmesh/db", () => ({
  prisma: {
    marketplacePreset: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@modelmesh/db";
import { revalidatePath } from "next/cache";

describe("marketplace actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getMarketplacePresets returns enabled presets with filters", async () => {
    vi.mocked(prisma.marketplacePreset.findMany).mockResolvedValue([{ id: "p1" }] as any);
    const result = await getMarketplacePresets({ category: "llm", search: "llama" });
    expect(result).toHaveLength(1);
    expect(prisma.marketplacePreset.findMany).toHaveBeenCalledWith({
      where: {
        enabled: true,
        category: "llm",
        OR: [
          { name: { contains: "llama", mode: "insensitive" } },
          { description: { contains: "llama", mode: "insensitive" } },
          { tags: { has: "llama" } },
        ],
      },
      orderBy: { downloads: "desc" },
    });
  });

  it("getMarketplacePresets returns presets without search", async () => {
    vi.mocked(prisma.marketplacePreset.findMany).mockResolvedValue([{ id: "p1" }, { id: "p2" }] as any);
    const result = await getMarketplacePresets({ category: "llm" });
    expect(result).toHaveLength(2);
    expect(prisma.marketplacePreset.findMany).toHaveBeenCalledWith({
      where: {
        enabled: true,
        category: "llm",
      },
      orderBy: { downloads: "desc" },
    });
  });

  it("getMarketplacePreset returns single preset", async () => {
    vi.mocked(prisma.marketplacePreset.findUnique).mockResolvedValue({ id: "p1" } as any);
    const result = await getMarketplacePreset("p1");
    expect(result).toEqual({ id: "p1" });
  });

  it("createMarketplacePreset uses defaults", async () => {
    vi.mocked(prisma.marketplacePreset.create).mockResolvedValue({ id: "p2" } as any);
    const result = await createMarketplacePreset({ name: "Qwen", providerName: "ollama", modelId: "qwen" });
    expect(prisma.marketplacePreset.create).toHaveBeenCalledWith({
      data: {
        name: "Qwen",
        description: undefined,
        category: "general",
        providerName: "ollama",
        modelId: "qwen",
        capabilities: [],
        contextWindow: 4096,
        pricingPrompt: 0,
        pricingCompletion: 0,
        tags: [],
        config: {},
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/marketplace");
  });

  it("createMarketplacePreset accepts overrides", async () => {
    vi.mocked(prisma.marketplacePreset.create).mockResolvedValue({ id: "p3" } as any);
    await createMarketplacePreset({
      name: "Custom",
      description: "A model",
      category: "vision",
      providerName: "openai",
      modelId: "gpt-4o",
      capabilities: ["vision", "streaming"],
      contextWindow: 128000,
      pricingPrompt: 0.005,
      pricingCompletion: 0.015,
      tags: ["fast"],
      config: { key: "value" },
    });
    expect(prisma.marketplacePreset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Custom",
        description: "A model",
        category: "vision",
        contextWindow: 128000,
        pricingPrompt: 0.005,
        pricingCompletion: 0.015,
        tags: ["fast"],
        config: { key: "value" },
      }),
    });
  });

  it("deleteMarketplacePreset removes and revalidates", async () => {
    vi.mocked(prisma.marketplacePreset.delete).mockResolvedValue({} as any);
    await deleteMarketplacePreset("p1");
    expect(prisma.marketplacePreset.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
    expect(revalidatePath).toHaveBeenCalledWith("/marketplace");
  });
});
