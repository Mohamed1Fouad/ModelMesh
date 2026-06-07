import { describe, it, expect, vi, beforeEach } from "vitest";
import { getApiKeys, createApiKey, revokeApiKey } from "../../src/actions/api-keys.js";

vi.mock("@modelmesh/db", () => ({
  prisma: {
    apiKey: {
      findMany: vi.fn(),
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

describe("api-keys actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getApiKeys returns all keys ordered by createdAt desc", async () => {
    vi.mocked(prisma.apiKey.findMany).mockResolvedValue([{ id: "k1", name: "Prod" }] as any);
    const result = await getApiKeys();
    expect(result).toHaveLength(1);
    expect(prisma.apiKey.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "desc" } });
  });

  it("createApiKey generates hash and returns raw key", async () => {
    vi.mocked(prisma.apiKey.create).mockResolvedValue({ id: "k1" } as any);
    const result = await createApiKey({ name: "Test" });
    expect(result.rawKey).toMatch(/^mm-[a-f0-9]{64}$/);
    expect(result.keyPrefix).toBe(result.rawKey.slice(0, 8));
    expect(prisma.apiKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Test", scopes: ["chat:write"] }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/api-keys");
  });

  it("createApiKey accepts optional fields", async () => {
    vi.mocked(prisma.apiKey.create).mockResolvedValue({ id: "k1" } as any);
    const expiresAt = new Date("2025-01-01");
    await createApiKey({ name: "Scoped", scopes: ["read"], rateLimitRpm: 60, rateLimitTpm: 1000, expiresAt });
    expect(prisma.apiKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Scoped", scopes: ["read"], rateLimitRpm: 60, rateLimitTpm: 1000, expiresAt }),
    });
  });

  it("createApiKey accepts custom scopes array", async () => {
    vi.mocked(prisma.apiKey.create).mockResolvedValue({ id: "k1" } as any);
    await createApiKey({ name: "Scoped", scopes: ["chat:write", "models:read", "usage:read"] });
    expect(prisma.apiKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Scoped", scopes: ["chat:write", "models:read", "usage:read"] }),
    });
  });

  it("createApiKey defaults to chat:write scope when none provided", async () => {
    vi.mocked(prisma.apiKey.create).mockResolvedValue({ id: "k1" } as any);
    await createApiKey({ name: "Default" });
    expect(prisma.apiKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Default", scopes: ["chat:write"] }),
    });
  });

  it("revokeApiKey deletes and revalidates", async () => {
    vi.mocked(prisma.apiKey.delete).mockResolvedValue({} as any);
    await revokeApiKey("k1");
    expect(prisma.apiKey.delete).toHaveBeenCalledWith({ where: { id: "k1" } });
    expect(revalidatePath).toHaveBeenCalledWith("/api-keys");
  });
});
