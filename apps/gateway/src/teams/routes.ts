import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@modelmesh/db";
import { v4 as uuidv4 } from "uuid";
import { authMiddleware, teamContextMiddleware, requirePermission, AuthenticatedRequest } from "../auth/middleware.js";

export async function registerTeamRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all team routes
  fastify.addHook("onRequest", authMiddleware);
  fastify.addHook("onRequest", teamContextMiddleware);

  // List teams for current user
  fastify.get("/v1/teams", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.status(401).send({ error: { message: "Authentication required", type: "authentication_error" } });

    const memberships = await prisma.teamMember.findMany({
      where: { userId: request.user.id },
      include: { team: true },
    });

    return reply.send({
      data: memberships.map((m) => ({
        id: m.team.id,
        name: m.team.name,
        slug: m.team.slug,
        description: m.team.description,
        enabled: m.team.enabled,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    });
  });

  // Get single team
  fastify.get("/v1/teams/:id", { preHandler: requirePermission("team:read") }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, email: true, name: true, avatar: true } } } },
        providers: { include: { provider: true } },
        budgets: true,
      },
    });
    if (!team) return reply.status(404).send({ error: { message: "Team not found", type: "not_found" } });

    return reply.send({
      id: team.id,
      name: team.name,
      slug: team.slug,
      description: team.description,
      enabled: team.enabled,
      members: team.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        email: m.user.email,
        name: m.user.name,
        avatar: m.user.avatar,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      providers: team.providers.map((tp) => ({
        id: tp.id,
        providerId: tp.providerId,
        name: tp.provider.name,
        enabled: tp.enabled,
        customBaseUrl: tp.customBaseUrl,
        weight: tp.weight,
      })),
      budgets: team.budgets,
    });
  });

  // Create team
  fastify.post("/v1/teams", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.status(401).send({ error: { message: "Authentication required", type: "authentication_error" } });
    const body = request.body as Record<string, unknown>;
    const name = String(body.name ?? "");
    const slug = String(body.slug ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const description = body.description ? String(body.description) : undefined;

    if (!name || !slug) {
      return reply.status(400).send({ error: { message: "Name and slug are required", type: "invalid_request_error" } });
    }

    const existing = await prisma.team.findUnique({ where: { slug } });
    if (existing) return reply.status(409).send({ error: { message: "Team slug already exists", type: "conflict" } });

    const team = await prisma.team.create({
      data: {
        name,
        slug,
        description,
        members: {
          create: { userId: request.user.id, role: "owner" },
        },
      },
    });

    return reply.status(201).send({ id: team.id, name: team.name, slug: team.slug });
  });

  // Update team
  fastify.put("/v1/teams/:id", { preHandler: requirePermission("team:write") }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const body = request.body as Record<string, unknown>;
    const team = await prisma.team.update({
      where: { id },
      data: {
        name: body.name !== undefined ? String(body.name) : undefined,
        description: body.description !== undefined ? String(body.description) : undefined,
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : undefined,
      },
    });
    return reply.send({ id: team.id, name: team.name, slug: team.slug, enabled: team.enabled });
  });

  // Delete team
  fastify.delete("/v1/teams/:id", { preHandler: requirePermission("team:write") }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    await prisma.team.delete({ where: { id } });
    return reply.status(204).send();
  });

  // Invite member
  fastify.post("/v1/teams/:id/invitations", { preHandler: requirePermission("team:write") }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const body = request.body as Record<string, unknown>;
    const email = String(body.email ?? "");
    const role = String(body.role ?? "developer");

    if (!email) return reply.status(400).send({ error: { message: "Email is required", type: "invalid_request_error" } });

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.teamInvitation.create({
      data: { teamId: id, email, role, token, expiresAt },
    });

    return reply.status(201).send({ id: invitation.id, email, role, token, expiresAt });
  });

  // List invitations
  fastify.get("/v1/teams/:id/invitations", { preHandler: requirePermission("team:read") }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as Record<string, string>;
    const invitations = await prisma.teamInvitation.findMany({
      where: { teamId: id, accepted: false, expiresAt: { gt: new Date() } },
    });
    return reply.send({ data: invitations });
  });

  // Accept invitation
  fastify.post("/v1/invitations/:token/accept", async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) return reply.status(401).send({ error: { message: "Authentication required", type: "authentication_error" } });
    const { token } = request.params as Record<string, string>;

    const invitation = await prisma.teamInvitation.findUnique({ where: { token } });
    if (!invitation || invitation.expiresAt < new Date() || invitation.accepted) {
      return reply.status(400).send({ error: { message: "Invalid or expired invitation", type: "invalid_request_error" } });
    }

    await prisma.$transaction([
      prisma.teamInvitation.update({ where: { id: invitation.id }, data: { accepted: true } }),
      prisma.teamMember.create({
        data: { teamId: invitation.teamId, userId: request.user.id, role: invitation.role },
      }),
    ]);

    return reply.send({ success: true, teamId: invitation.teamId });
  });

  // Update member role
  fastify.put("/v1/teams/:id/members/:memberId", { preHandler: requirePermission("team:write") }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { memberId } = request.params as Record<string, string>;
    const body = request.body as Record<string, unknown>;
    const role = String(body.role ?? "developer");

    const member = await prisma.teamMember.update({
      where: { id: memberId },
      data: { role },
    });

    return reply.send({ id: member.id, role: member.role });
  });

  // Remove member
  fastify.delete("/v1/teams/:id/members/:memberId", { preHandler: requirePermission("team:write") }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { memberId } = request.params as Record<string, string>;
    await prisma.teamMember.delete({ where: { id: memberId } });
    return reply.status(204).send();
  });

  // Update team provider settings
  fastify.put("/v1/teams/:id/providers/:providerId", { preHandler: requirePermission("team:write") }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id, providerId } = request.params as Record<string, string>;
    const body = request.body as Record<string, unknown>;

    const tp = await prisma.teamProvider.upsert({
      where: { teamId_providerId: { teamId: id, providerId } },
      update: {
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : undefined,
        customBaseUrl: body.customBaseUrl !== undefined ? String(body.customBaseUrl) : undefined,
        customApiKey: body.customApiKey !== undefined ? String(body.customApiKey) : undefined,
        weight: body.weight !== undefined ? Number(body.weight) : undefined,
      },
      create: {
        teamId: id,
        providerId,
        enabled: Boolean(body.enabled ?? true),
        customBaseUrl: body.customBaseUrl ? String(body.customBaseUrl) : undefined,
        customApiKey: body.customApiKey ? String(body.customApiKey) : undefined,
        weight: Number(body.weight ?? 1),
      },
    });

    return reply.send(tp);
  });
}
