import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@modelmesh/db";

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    teamId?: string;
    teamRole?: string;
  };
}

const PERMISSIONS: Record<string, string[]> = {
  owner: ["*"],
  admin: [
    "provider:read", "provider:write",
    "rule:read", "rule:write",
    "key:read", "key:write",
    "usage:read",
    "agent:read", "agent:write",
    "workflow:read", "workflow:write",
    "team:read", "team:write",
    "audit:read",
    "marketplace:read", "marketplace:write",
  ],
  developer: [
    "provider:read",
    "rule:read",
    "key:read", "key:write",
    "usage:read",
    "agent:read", "agent:write",
    "workflow:read", "workflow:write",
    "marketplace:read",
  ],
  viewer: [
    "provider:read",
    "rule:read",
    "usage:read",
    "agent:read",
    "workflow:read",
    "marketplace:read",
  ],
};

export async function authMiddleware(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers["x-api-key"] as string | undefined;
  const bearer = request.headers.authorization?.replace("Bearer ", "");

  if (apiKey) {
    const keyRecord = await prisma.apiKey.findUnique({
      where: { keyHash: apiKey },
    });
    if (!keyRecord || (keyRecord.expiresAt && keyRecord.expiresAt < new Date())) {
      return reply.status(401).send({ error: { message: "Invalid or expired API key", type: "authentication_error" } });
    }
    await prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
    });
    request.user = {
      id: "api-key",
      email: keyRecord.name,
      name: keyRecord.name,
      role: "api_key",
    };
    return;
  }

  if (bearer) {
    const session = await prisma.userSession.findUnique({
      where: { token: bearer },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return reply.status(401).send({ error: { message: "Invalid or expired session", type: "authentication_error" } });
    }

    request.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    };
    return;
  }

  // Allow unauthenticated for local development if configured
  if (process.env.ALLOW_UNAUTHENTICATED === "true") {
    request.user = {
      id: "anonymous",
      email: "anonymous@local",
      name: "Anonymous",
      role: "user",
    };
    return;
  }

  return reply.status(401).send({ error: { message: "Authentication required", type: "authentication_error" } });
}

export function requirePermission(permission: string) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: { message: "Authentication required", type: "authentication_error" } });
    }

    // Super admin bypass
    if (request.user.role === "super_admin") return;

    const teamRole = request.user.teamRole;
    if (!teamRole) {
      return reply.status(403).send({ error: { message: "Not a team member", type: "authorization_error" } });
    }

    const perms = PERMISSIONS[teamRole] ?? [];
    if (perms.includes("*")) return;
    if (perms.includes(permission)) return;

    return reply.status(403).send({
      error: { message: `Permission denied: ${permission}`, type: "authorization_error" },
    });
  };
}

export async function teamContextMiddleware(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user || request.user.id === "api-key" || request.user.id === "anonymous") return;

  const teamId = (request.query as Record<string, string>)?.teamId
    ?? (request.body as Record<string, string>)?.teamId
    ?? (request.params as Record<string, string>)?.teamId;

  if (!teamId) return;

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: request.user.id } },
  });

  if (membership) {
    request.user.teamId = teamId;
    request.user.teamRole = membership.role;
  }
}
