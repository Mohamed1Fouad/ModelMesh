import { prisma } from "@modelmesh/db";
import type { AgentMemory } from "@modelmesh/shared";

export class MemoryService {
  async addMemory(data: {
    agentId: string;
    sessionId?: string;
    type: "conversation" | "fact" | "preference";
    content: string;
    embedding?: number[];
    metadata?: Record<string, unknown>;
  }): Promise<AgentMemory> {
    const db = await prisma.agentMemory.create({
      data: {
        agentId: data.agentId,
        sessionId: data.sessionId,
        type: data.type,
        content: data.content,
        embedding: data.embedding as object ?? undefined,
        metadata: data.metadata as object ?? undefined,
      },
    });

    return {
      id: db.id,
      agentId: db.agentId,
      sessionId: db.sessionId ?? undefined,
      type: db.type as AgentMemory["type"],
      content: db.content,
      embedding: (db.embedding as number[]) ?? undefined,
      metadata: (db.metadata as Record<string, unknown>) ?? undefined,
      createdAt: db.createdAt,
    };
  }

  async getMemories(params: {
    agentId: string;
    sessionId?: string;
    type?: "conversation" | "fact" | "preference";
    limit?: number;
  }): Promise<AgentMemory[]> {
    const rows = await prisma.agentMemory.findMany({
      where: {
        agentId: params.agentId,
        ...(params.sessionId ? { sessionId: params.sessionId } : {}),
        ...(params.type ? { type: params.type } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: params.limit ?? 20,
    });

    return rows.map((r: { id: string; agentId: string; sessionId: string | null; type: string; content: string; embedding: unknown; metadata: unknown; createdAt: Date }) => ({
      id: r.id,
      agentId: r.agentId,
      sessionId: r.sessionId ?? undefined,
      type: r.type as AgentMemory["type"],
      content: r.content,
      embedding: (r.embedding as number[]) ?? undefined,
      metadata: (r.metadata as Record<string, unknown>) ?? undefined,
      createdAt: r.createdAt,
    }));
  }

  async searchSimilar(params: {
    agentId: string;
    embedding: number[];
    limit?: number;
  }): Promise<AgentMemory[]> {
    // Simple cosine similarity without pgvector
    const rows = await prisma.agentMemory.findMany({
      where: {
        agentId: params.agentId,
        embedding: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const scored = rows
      .map((r: { embedding: unknown }) => {
        const emb = r.embedding as number[] | null;
        if (!emb || emb.length !== params.embedding.length) return null;

        const similarity = cosineSimilarity(params.embedding, emb);
        return {
          ...r,
          similarity,
        };
      })
      .filter((r: { embedding: unknown; similarity: number } | null): r is { embedding: unknown; similarity: number } => r !== null)
      .sort((a: { similarity: number }, b: { similarity: number }) => b.similarity - a.similarity)
      .slice(0, params.limit ?? 5);

    return scored.map((r: { id: string; agentId: string; sessionId: string | null; type: string; content: string; embedding: unknown; metadata: unknown; createdAt: Date }) => ({
      id: r.id,
      agentId: r.agentId,
      sessionId: r.sessionId ?? undefined,
      type: r.type as AgentMemory["type"],
      content: r.content,
      embedding: (r.embedding as number[]) ?? undefined,
      metadata: (r.metadata as Record<string, unknown>) ?? undefined,
      createdAt: r.createdAt,
    }));
  }

  async getSessionContext(sessionId: string): Promise<string> {
    const memories = await prisma.agentMemory.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    if (memories.length === 0) return "";

    return memories.map((m: { type: string; content: string }) => `[${m.type}] ${m.content}`).join("\n");
  }

  async closeSession(sessionId: string): Promise<void> {
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: "closed" },
    });
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
