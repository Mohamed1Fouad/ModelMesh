import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProviders, getProvider, createProvider, updateProvider, deleteProvider, createModel, updateModel, deleteModel } from "../../src/actions/providers.js";

vi.mock("@modelmesh/db", () => ({
  prisma: {
    provider: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    model: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@modelmesh/db";
import { revalidatePath } from "next/cache";

describe("providers actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getProviders returns providers with models", async () => {
    vi.mocked(prisma.provider.findMany).mockResolvedValue([{ id: "p1" }] as any);
    const result = await getProviders();
    expect(result).toHaveLength(1);
    expect(prisma.provider.findMany).toHaveBeenCalledWith({
      include: { models: { orderBy: { name: "asc" } } },
      orderBy: { displayName: "asc" },
    });
  });

  it("getProvider returns single with models", async () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({ id: "p1" } as any);
    const result = await getProvider("p1");
    expect(result).toEqual({ id: "p1" });
    expect(prisma.provider.findUnique).toHaveBeenCalledWith({ where: { id: "p1" }, include: { models: true } });
  });

  it("createProvider applies defaults", async () => {
    vi.mocked(prisma.provider.create).mockResolvedValue({ id: "p1" } as any);
    await createProvider({ name: "openai", displayName: "OpenAI" });
    expect(prisma.provider.create).toHaveBeenCalledWith({
      data: {
        name: "openai",
        displayName: "OpenAI",
        baseUrl: undefined,
        apiKey: undefined,
        timeoutMs: 30000,
        retries: 3,
        weight: 1,
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/providers");
  });

  it("updateProvider patches fields", async () => {
    vi.mocked(prisma.provider.update).mockResolvedValue({ id: "p1" } as any);
    await updateProvider("p1", { displayName: "New", enabled: false, timeoutMs: 15000 });
    expect(prisma.provider.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { displayName: "New", enabled: false, timeoutMs: 15000 },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/providers");
    expect(revalidatePath).toHaveBeenCalledWith("/providers/p1");
  });

  it("deleteProvider removes and revalidates", async () => {
    vi.mocked(prisma.provider.delete).mockResolvedValue({} as any);
    await deleteProvider("p1");
    expect(prisma.provider.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
    expect(revalidatePath).toHaveBeenCalledWith("/providers");
  });

  it("createModel applies defaults", async () => {
    vi.mocked(prisma.model.create).mockResolvedValue({ id: "m1" } as any);
    await createModel({
      providerId: "p1",
      externalId: "gpt-4o",
      openRouterId: "openai/gpt-4o",
      name: "GPT-4o",
      contextWindow: 128000,
      capabilities: ["chat"],
    });
    expect(prisma.model.create).toHaveBeenCalledWith({
      data: {
        providerId: "p1",
        externalId: "gpt-4o",
        openRouterId: "openai/gpt-4o",
        name: "GPT-4o",
        contextWindow: 128000,
        maxTokens: undefined,
        capabilities: ["chat"],
        supportsStreaming: true,
        supportsToolUse: false,
        promptPricePer1k: 0,
        completionPricePer1k: 0,
        latencyTtftMs: 500,
        latencyThroughputTokensPerSec: 50,
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/providers");
  });

  it("updateModel patches fields", async () => {
    vi.mocked(prisma.model.update).mockResolvedValue({ id: "m1" } as any);
    await updateModel("m1", { name: "GPT-4o-new", enabled: false });
    expect(prisma.model.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { name: "GPT-4o-new", enabled: false },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/providers");
  });

  it("deleteModel removes and revalidates", async () => {
    vi.mocked(prisma.model.delete).mockResolvedValue({} as any);
    await deleteModel("m1");
    expect(prisma.model.delete).toHaveBeenCalledWith({ where: { id: "m1" } });
    expect(revalidatePath).toHaveBeenCalledWith("/providers");
  });
});
