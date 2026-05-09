import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryService } from "../../src/agents/memory-service.js";

vi.mock("@modelmesh/db", () => ({
  prisma: {
    agentMemory: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    agentSession: {
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@modelmesh/db";

describe("MemoryService", () => {
  const service = new MemoryService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds a memory and returns it", async () => {
    vi.mocked(prisma.agentMemory.create).mockResolvedValue({
      id: "mem-1",
      agentId: "agent-1",
      sessionId: "sess-1",
      type: "fact",
      content: "The sky is blue",
      embedding: [0.1, 0.2],
      metadata: { source: "user" },
      createdAt: new Date("2024-01-01"),
    } as any);

    const result = await service.addMemory({
      agentId: "agent-1",
      sessionId: "sess-1",
      type: "fact",
      content: "The sky is blue",
      embedding: [0.1, 0.2],
      metadata: { source: "user" },
    });

    expect(result.id).toBe("mem-1");
    expect(result.type).toBe("fact");
    expect(result.embedding).toEqual([0.1, 0.2]);
    expect(prisma.agentMemory.create).toHaveBeenCalledWith({
      data: {
        agentId: "agent-1",
        sessionId: "sess-1",
        type: "fact",
        content: "The sky is blue",
        embedding: [0.1, 0.2],
        metadata: { source: "user" },
      },
    });
  });

  it("gets memories filtered by agent, session, type", async () => {
    vi.mocked(prisma.agentMemory.findMany).mockResolvedValue([
      { id: "mem-1", agentId: "a1", sessionId: "s1", type: "conversation", content: "Hi", createdAt: new Date() },
      { id: "mem-2", agentId: "a1", sessionId: "s1", type: "conversation", content: "Hello", createdAt: new Date() },
    ] as any);

    const result = await service.getMemories({ agentId: "a1", sessionId: "s1", type: "conversation", limit: 5 });
    expect(result).toHaveLength(2);
    expect(prisma.agentMemory.findMany).toHaveBeenCalledWith({
      where: { agentId: "a1", sessionId: "s1", type: "conversation" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
  });

  it("gets memories without optional filters", async () => {
    vi.mocked(prisma.agentMemory.findMany).mockResolvedValue([] as any);
    await service.getMemories({ agentId: "a1" });
    expect(prisma.agentMemory.findMany).toHaveBeenCalledWith({
      where: { agentId: "a1" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  });

  it("searches similar memories by cosine similarity", async () => {
    vi.mocked(prisma.agentMemory.findMany).mockResolvedValue([
      { id: "m1", agentId: "a1", embedding: [1, 0], content: "A", createdAt: new Date() },
      { id: "m2", agentId: "a1", embedding: [0, 1], content: "B", createdAt: new Date() },
      { id: "m3", agentId: "a1", embedding: [0.9, 0.1], content: "C", createdAt: new Date() },
    ] as any);

    const result = await service.searchSimilar({ agentId: "a1", embedding: [1, 0], limit: 2 });
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("A");
    expect(result[1].content).toBe("C");
  });

  it("excludes memories with null or mismatched embedding length", async () => {
    vi.mocked(prisma.agentMemory.findMany).mockResolvedValue([
      { id: "m1", agentId: "a1", embedding: null, content: "Null", createdAt: new Date() },
      { id: "m2", agentId: "a1", embedding: [1, 0, 0], content: "Wrong length", createdAt: new Date() },
      { id: "m3", agentId: "a1", embedding: [1, 0], content: "Match", createdAt: new Date() },
    ] as any);

    const result = await service.searchSimilar({ agentId: "a1", embedding: [1, 0] });
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Match");
  });

  it("returns session context as formatted string", async () => {
    vi.mocked(prisma.agentMemory.findMany).mockResolvedValue([
      { id: "m1", type: "conversation", content: "Hi", createdAt: new Date("2024-01-01") },
      { id: "m2", type: "fact", content: "User likes Python", createdAt: new Date("2024-01-02") },
    ] as any);

    const ctx = await service.getSessionContext("sess-1");
    expect(ctx).toBe("[conversation] Hi\n[fact] User likes Python");
    expect(prisma.agentMemory.findMany).toHaveBeenCalledWith({
      where: { sessionId: "sess-1" },
      orderBy: { createdAt: "asc" },
      take: 10,
    });
  });

  it("returns empty string when no session memories", async () => {
    vi.mocked(prisma.agentMemory.findMany).mockResolvedValue([] as any);
    const ctx = await service.getSessionContext("sess-1");
    expect(ctx).toBe("");
  });

  it("closes a session", async () => {
    vi.mocked(prisma.agentSession.update).mockResolvedValue({} as any);
    await service.closeSession("sess-1");
    expect(prisma.agentSession.update).toHaveBeenCalledWith({
      where: { id: "sess-1" },
      data: { status: "closed" },
    });
  });
});
