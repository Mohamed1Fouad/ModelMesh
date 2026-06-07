import type { FastifyInstance, FastifyReply } from "fastify";
import { prisma } from "@modelmesh/db";
import { authMiddleware, requirePermission } from "../auth/middleware.js";
import type { AuthenticatedRequest } from "../auth/middleware.js";

export async function registerMarketplaceRoutes(fastify: FastifyInstance) {
  await fastify.register(async (scoped) => {
    scoped.addHook("onRequest", authMiddleware);

  // List marketplace presets
  scoped.get("/v1/marketplace", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const category = query.category;
    const search = query.search;

    const presets = await prisma.marketplacePreset.findMany({
      where: {
        enabled: true,
        ...(category ? { category } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                { tags: { has: search } },
              ],
            }
          : {}),
      },
      orderBy: { downloads: "desc" },
    });

    return reply.send({
      data: presets.map((p: { id: string; name: string; description: string | null; category: string; providerName: string; modelId: string; capabilities: string[]; contextWindow: number; pricingPrompt: number; pricingCompletion: number; tags: string[]; downloads: number; rating: number; config: unknown }) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        providerName: p.providerName,
        modelId: p.modelId,
        capabilities: p.capabilities,
        contextWindow: p.contextWindow,
        pricingPrompt: p.pricingPrompt,
        pricingCompletion: p.pricingCompletion,
        tags: p.tags,
        downloads: p.downloads,
        rating: p.rating,
        config: p.config,
      })),
    });
  });

  // Get single preset
  scoped.get("/v1/marketplace/:id", async (_request, reply: FastifyReply) => {
    const { id } = _request.params as Record<string, string>;
    const preset = await prisma.marketplacePreset.findUnique({ where: { id } });
    if (!preset) return reply.status(404).send({ error: { message: "Preset not found", type: "not_found" } });
    return reply.send(preset);
  });

  // Install preset (self-hosted: creates a local provider + model)
  scoped.post("/v1/marketplace/:id/install", { preHandler: requirePermission("marketplace:write") }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const preset = await prisma.marketplacePreset.findUnique({ where: { id } });
    if (!preset) return reply.status(404).send({ error: { message: "Preset not found", type: "not_found" } });

    const provider = await prisma.provider.upsert({
      where: { name: preset.providerName },
      update: {},
      create: {
        name: preset.providerName,
        displayName: preset.providerName,
        baseUrl: null,
        apiKey: null,
        enabled: true,
      },
    });

    const model = await prisma.model.upsert({
      where: { providerId_externalId: { providerId: provider.id, externalId: preset.modelId } },
      update: {},
      create: {
        providerId: provider.id,
        externalId: preset.modelId,
        name: preset.name,
        contextWindow: preset.contextWindow,
        capabilities: preset.capabilities,
        supportsStreaming: preset.capabilities.includes("streaming"),
        supportsToolUse: preset.capabilities.includes("tool_use") || preset.capabilities.includes("function_calling"),
        promptPricePer1k: preset.pricingPrompt,
        completionPricePer1k: preset.pricingCompletion,
      },
    });

    await prisma.marketplacePreset.update({
      where: { id },
      data: { downloads: { increment: 1 } },
    });

    return reply.status(201).send({
      providerId: provider.id,
      modelId: model.id,
      message: `Installed ${preset.name} as ${preset.providerName}/${preset.modelId}`,
    });
  });

  // Create marketplace preset (admin only)
  scoped.post("/v1/marketplace", { preHandler: requirePermission("marketplace:write") }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const preset = await prisma.marketplacePreset.create({
      data: {
        name: String(body.name ?? ""),
        description: body.description ? String(body.description) : null,
        category: String(body.category ?? "general"),
        providerName: String(body.providerName ?? ""),
        modelId: String(body.modelId ?? ""),
        capabilities: Array.isArray(body.capabilities) ? body.capabilities as string[] : [],
        contextWindow: Number(body.contextWindow ?? 4096),
        pricingPrompt: Number(body.pricingPrompt ?? 0),
        pricingCompletion: Number(body.pricingCompletion ?? 0),
        config: body.config && typeof body.config === "object" ? body.config : {},
        tags: Array.isArray(body.tags) ? body.tags as string[] : [],
      },
    });

    return reply.status(201).send(preset);
  });

  // Delete preset
  scoped.delete("/v1/marketplace/:id", { preHandler: requirePermission("marketplace:write") }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    await prisma.marketplacePreset.delete({ where: { id } });
    return reply.status(204).send();
  });
  });
}
