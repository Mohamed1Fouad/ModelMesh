import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRoutingRules, createRoutingRule, updateRoutingRule, deleteRoutingRule, toggleRoutingRule } from "../../src/actions/routing-rules.js";

vi.mock("@modelmesh/db", () => ({
  prisma: {
    routingRule: {
      findMany: vi.fn(),
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

describe("routing-rules actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getRoutingRules orders by priority desc then createdAt desc", async () => {
    vi.mocked(prisma.routingRule.findMany).mockResolvedValue([{ id: "r1" }] as any);
    const result = await getRoutingRules();
    expect(result).toHaveLength(1);
    expect(prisma.routingRule.findMany).toHaveBeenCalledWith({
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  });

  it("createRoutingRule casts condition and action", async () => {
    vi.mocked(prisma.routingRule.create).mockResolvedValue({ id: "r2" } as any);
    const result = await createRoutingRule({ name: "Local", priority: 10, condition: { provider: "ollama" }, action: { route_to: "ollama" } });
    expect(prisma.routingRule.create).toHaveBeenCalledWith({
      data: {
        name: "Local",
        priority: 10,
        condition: { provider: "ollama" },
        action: { route_to: "ollama" },
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/routing");
  });

  it("updateRoutingRule casts condition and action when present", async () => {
    vi.mocked(prisma.routingRule.update).mockResolvedValue({ id: "r1" } as any);
    await updateRoutingRule("r1", { name: "Updated", enabled: false, condition: { foo: "bar" }, action: { score_boost: 10 } });
    expect(prisma.routingRule.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: {
        name: "Updated",
        enabled: false,
        condition: { foo: "bar" },
        action: { score_boost: 10 },
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/routing");
  });

  it("updateRoutingRule omits undefined condition and action", async () => {
    vi.mocked(prisma.routingRule.update).mockResolvedValue({ id: "r1" } as any);
    await updateRoutingRule("r1", { name: "Updated" });
    expect(prisma.routingRule.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: {
        name: "Updated",
        condition: undefined,
        action: undefined,
      },
    });
  });

  it("deleteRoutingRule removes and revalidates", async () => {
    vi.mocked(prisma.routingRule.delete).mockResolvedValue({} as any);
    await deleteRoutingRule("r1");
    expect(prisma.routingRule.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
    expect(revalidatePath).toHaveBeenCalledWith("/routing");
  });

  it("toggleRoutingRule updates enabled flag", async () => {
    vi.mocked(prisma.routingRule.update).mockResolvedValue({ id: "r1", enabled: false } as any);
    const result = await toggleRoutingRule("r1", false);
    expect(result.enabled).toBe(false);
    expect(prisma.routingRule.update).toHaveBeenCalledWith({ where: { id: "r1" }, data: { enabled: false } });
    expect(revalidatePath).toHaveBeenCalledWith("/routing");
  });
});
