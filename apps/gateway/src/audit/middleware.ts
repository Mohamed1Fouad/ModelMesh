import type { FastifyReply } from "fastify";
import { prisma } from "@modelmesh/db";
import type { AuthenticatedRequest } from "../auth/middleware.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function auditLogMiddleware(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  // Defer logging until after response is sent
  reply.raw.on("finish", async () => {
    try {
      const method = request.method;
      if (!MUTATING_METHODS.has(method)) return;

      // Skip audit log routes to avoid recursion
      if (request.url.startsWith("/v1/audit-logs")) return;

      const rawUserId = request.user?.id;
      const userId = rawUserId === "api-key" || rawUserId === "anonymous" ? null : rawUserId;
      const teamId = request.user?.teamId;
      const action = method.toLowerCase();
      const resource = inferResource(request.url);
      const resourceId = inferResourceId(request.url);

      await prisma.auditLog.create({
        data: {
          userId,
          teamId,
          action,
          resource,
          resourceId,
          details: { body: sanitizeBody(request.body), query: request.query, params: request.params },
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        },
      });
    } catch {
      // Silent fail — don't break the response for audit logging issues
    }
  });
}

function inferResource(url: string): string {
  if (url.includes("/providers")) return "provider";
  if (url.includes("/models")) return "model";
  if (url.includes("/rules")) return "rule";
  if (url.includes("/api-keys")) return "key";
  if (url.includes("/agents")) return "agent";
  if (url.includes("/workflows")) return "workflow";
  if (url.includes("/teams")) return "team";
  if (url.includes("/marketplace")) return "marketplace";
  if (url.includes("/chat/completions")) return "api";
  return "unknown";
}

function inferResourceId(url: string): string | undefined {
  const parts = url.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && !last.includes("?") && last.length > 8) return last;
  return undefined;
}

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const safe = { ...body as Record<string, unknown> };
  if ("apiKey" in safe) safe.apiKey = "***";
  if ("keyHash" in safe) safe.keyHash = "***";
  if ("customApiKey" in safe) safe.customApiKey = "***";
  if ("password" in safe) safe.password = "***";
  if ("token" in safe) safe.token = "***";
  return safe;
}
